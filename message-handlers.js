// message-handlers.js - Обработчики сообщений

import {
  ENV,
  WorkerContext
} from './config.js';

import {
  createTelegramBotAPI,
  MessageSender,
  TELEGRAM_AUTH_CHECKER,
  isGroupChat,
  loadHistory,
  requestCompletionsFromLLM
} from './api.js';

import {
  extractImageFileID,
  extractImageURL,
  GroupMention
} from './api-telegram.js';

import {
  loadChatLLM,
  searchOnline,
  OpenAI
} from './ai-providers.js';

import {
  handleCommandMessage
} from './telegram-utils.js';

import {
  handleCallbackQuery
} from './callback-handlers.js';

import {
  ModelParamsCommandHandler
} from './telegram-model-commands.js';


export async function chatWithMessage(message, params, context, modifier) {
  const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
  try {
    try {
      const msg = await sender.sendPlainText("...").then((r) => r.json());
      sender.update({
        message_id: msg.result.message_id
      });
    } catch (e) {
      console.error(e);
    }
    const api = createTelegramBotAPI(context.SHARE_CONTEXT.botToken);
    setTimeout(() => api.sendChatAction({
      chat_id: message.chat.id,
      action: "typing"
    }).catch(console.error), 0);
    let onStream = null;
    let nextEnableTime = null;
    if (ENV.STREAM_MODE) {
      onStream = async (text) => {
        try {
          if (nextEnableTime && nextEnableTime > Date.now()) {
            return;
          }
          const resp = await sender.sendPlainText(text);
          if (resp.status === 429) {
            const retryAfter = Number.parseInt(resp.headers.get("Retry-After") || "");
            if (retryAfter) {
              nextEnableTime = Date.now() + retryAfter * 1e3;
              return;
            }
          }
          nextEnableTime = null;
          if (resp.ok) {
            const respJson = await resp.json();
            sender.update({
              message_id: respJson.result.message_id
            });
          }
        } catch (e) {
          console.error(e);
        }
      };
    }
    const agent = loadChatLLM(context.USER_CONFIG);
    if (agent === null) {
      return sender.sendPlainText("LLM is not enable");
    }
    
    // Проверяем, включено ли кэширование
    if (!context.USER_CONFIG.ENABLE_CACHING) {
      // Если кэширование выключено, очищаем историю перед каждым запросом
      await ENV.DATABASE.delete(context.SHARE_CONTEXT.chatHistoryKey);
    }
    
    // Если поиск в интернете включен
    if (context.USER_CONFIG.IS_ONLINE) {
      try {
        // Отправляем сообщение о поиске
        await sender.sendPlainText("Выполняю поиск в интернете...");
        
        // Выполняем поиск
        const searchResults = await searchOnline(params.content);
        
        // Добавляем результаты поиска к запросу пользователя
        const currentDate = new Date().toLocaleString('ru-RU');
        
        if (typeof params.content === 'string') {
          params.content = `${params.content}\n\nСегодня ${currentDate}.\n\n${searchResults}\n\nПожалуйста, используй эту актуальную информацию для ответа на вопрос.`;
        } else if (Array.isArray(params.content)) {
          // Для мультимодальных сообщений модифицируем только текстовую часть
          params.content = params.content.map(item => {
            if (item.type === 'text') {
              return {
                ...item,
                text: `${item.text}\n\nСегодня ${currentDate}.\n\n${searchResults}\n\nПожалуйста, используй эту актуальную информацию для ответа на вопрос.`
              };
            }
            return item;
          });
        }
        
        // Отправляем отладочное сообщение с результатами поиска
        await sender.sendPlainText(`Результаты поиска получены. Отправляю запрос модели...`);
      } catch (error) {
        console.error("Error during online search:", error);
        await sender.sendPlainText(`Ошибка при поиске в интернете: ${error.message}`);
      }
    }
    
    // Применяем модификатор, если он есть
    if (modifier) {
      const history = await loadHistory(context);
      const modifiedData = modifier(history, params);
      params = modifiedData.message;
    }
    
    const answer = await requestCompletionsFromLLM(params, context, agent, null, onStream);
    
    if (nextEnableTime !== null && nextEnableTime > Date.now()) {
      await new Promise((resolve) => setTimeout(resolve, (nextEnableTime ?? 0) - Date.now()));
    }
    return sender.sendRichText(answer);
  } catch (e) {
    let errMsg = `Error: ${e.message}`;
    if (errMsg.length > 2048) {
      errMsg = errMsg.substring(0, 2048);
    }
    return sender.sendPlainText(errMsg);
  }
}

export async function extractUserMessageItem(message, context) {
  let text = message.text || message.caption || "";
  const urls = await extractImageURL(extractImageFileID(message), context).then((u) => u ? [u] : []);
  if (ENV.EXTRA_MESSAGE_CONTEXT && message.reply_to_message && message.reply_to_message.from && `${message.reply_to_message.from.id}` !== `${context.SHARE_CONTEXT.botId}`) {
    const extraText = message.reply_to_message.text || message.reply_to_message.caption || "";
    if (extraText) {
      text = `${text}
The following is the referenced context: ${extraText}`;
    }
    if (ENV.EXTRA_MESSAGE_MEDIA_COMPATIBLE.includes("image") && message.reply_to_message.photo) {
      const url = await extractImageURL(extractImageFileID(message.reply_to_message), context);
      if (url) {
        urls.push(url);
      }
    }
  }
  
  // Если есть изображения, но нет текста, добавляем стандартный запрос на анализ
  if (urls.length > 0 && !text.trim()) {
    text = "Проанализируй это изображение и опиши его содержимое. Если на изображении есть текст, прочитай его полностью. Если это ноты, укажи названия нот и их расположение.";
  }
  
  const params = {
    role: "user",
    content: text
  };
  if (urls.length > 0) {
    const contents = new Array();
    if (text) {
      contents.push({ type: "text", text });
    }
    for (const url of urls) {
      contents.push({ type: "image", image: url });
    }
    params.content = contents;
  }
  return params;
}

export class EnvChecker {
  handle = async (update, context) => {
    if (!ENV.DATABASE) {
      return MessageSender.fromUpdate(context.SHARE_CONTEXT.botToken, update).sendPlainText("DATABASE Not Set");
    }
    return null;
  };
}

export class WhiteListFilter {
  handle = async (update, context) => {
    if (ENV.I_AM_A_GENEROUS_PERSON) {
      return null;
    }
    const sender = MessageSender.fromUpdate(context.SHARE_CONTEXT.botToken, update);
    let chatType = "";
    let chatID = 0;
    if (update.message) {
      chatType = update.message.chat.type;
      chatID = update.message.chat.id;
    } else if (update.callback_query?.message) {
      chatType = update.callback_query.message.chat.type;
      chatID = update.callback_query.message.chat.id;
    }
    if (!chatType || !chatID) {
      throw new Error("Invalid chat type or chat id");
    }
    const text = `You are not in the white list, please contact the administrator to add you to the white list. Your chat_id: ${chatID}`;
    if (chatType === "private") {
      if (!ENV.CHAT_WHITE_LIST.includes(`${chatID}`)) {
        return sender.sendPlainText(text);
      }
      return null;
    }
    if (isGroupChat(chatType)) {
      if (!ENV.GROUP_CHAT_BOT_ENABLE) {
        throw new Error("Not support");
      }
      if (!ENV.CHAT_GROUP_WHITE_LIST.includes(`${chatID}`)) {
        return sender.sendPlainText(text);
      }
      return null;
    }
    return sender.sendPlainText(
      `Not support chat type: ${chatType}`
    );
  };
}

export class Update2MessageHandler {
  messageHandlers;
  constructor(messageHandlers) {
    this.messageHandlers = messageHandlers;
  }
  loadMessage(body) {
    if (body.edited_message) {
      throw new Error("Ignore edited message");
    }
    if (body.message) {
      return body?.message;
    } else {
      throw new Error("Invalid message");
    }
  }
  handle = async (update, context) => {
    const message = this.loadMessage(update);
    if (!message) {
      return null;
    }
    for (const handler of this.messageHandlers) {
      const result = await handler.handle(message, context);
      if (result) {
        return result;
      }
    }
    return null;
  };
}

export class SaveLastMessage {
  handle = async (message, context) => {
    if (!ENV.DEBUG_MODE) {
      return null;
    }
    const lastMessageKey = `last_message:${context.SHARE_CONTEXT.chatHistoryKey}`;
    await ENV.DATABASE.put(lastMessageKey, JSON.stringify(message), { expirationTtl: 3600 });
    return null;
  };
}

export class OldMessageFilter {
  handle = async (message, context) => {
    if (!ENV.SAFE_MODE) {
      return null;
    }
    let idList = [];
    try {
      idList = JSON.parse(await ENV.DATABASE.get(context.SHARE_CONTEXT.lastMessageKey).catch(() => "[]")) || [];
    } catch (e) {
      console.error(e);
    }
    if (idList.includes(message.message_id)) {
      throw new Error("Ignore old message");
    } else {
      idList.push(message.message_id);
      if (idList.length > 100) {
        idList.shift();
      }
      await ENV.DATABASE.put(context.SHARE_CONTEXT.lastMessageKey, JSON.stringify(idList));
    }
    return null;
  };
}

export class MessageFilter {
  handle = async (message, context) => {
    // Если есть текст или подпись — пропускаем дальше для обработки в ChatHandler
    if (message.text) {
      return null;
    }
    if (message.caption) {
      return null;
    }
    
    // Если есть изображение (фото или документ с изображением) — пропускаем дальше
    if (message.photo && message.photo.length > 0) {
      return null;
    }
    if (message.document && 
        message.document.mime_type && 
        message.document.mime_type.startsWith("image/")) {
      return null;
    }
    
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    let fileId = null;
    let mimeType = null;
    let fileType = null; // Тип файла: 'audio'
    
    // Проверяем, есть ли голосовое сообщение
    if (message.voice) {
      fileId = message.voice.file_id;
      mimeType = message.voice.mime_type || "audio/ogg";
      fileType = 'audio';
    }
    // Проверяем, есть ли аудио файл
    else if (message.audio) {
      fileId = message.audio.file_id;
      mimeType = message.audio.mime_type || "audio/mpeg";
      fileType = 'audio';
    }
    
    // Если нашли аудио файл - сообщаем, что не поддерживается
    if (fileId && fileType === 'audio') {
      return sender.sendPlainText("Пожалуйста, отправьте ваш запрос текстом.");
    }
    
    // Если формат не поддерживается, сообщим об этом
    return MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message)
      .sendPlainText("Неподдерживаемый тип сообщения. Я могу обрабатывать только текст и изображения.");
  };
}

export class CommandHandler {
  handle = async (message, context) => {
    if (message.text || message.caption) {
      return await handleCommandMessage(message, context);
    }
    return null;
  };
}

export class ChatHandler {
  handle = async (message, context) => {
    const params = await extractUserMessageItem(message, context);
    return chatWithMessage(message, params, context, null);
  };
}

export class CallbackQueryHandler {
  handle = async (update, context) => {
    if (update.callback_query) {
      return handleCallbackQuery(update.callback_query, context);
    }
    return null;
  };
}

// Обработчик для ввода пользовательских значений параметров модели
export class CustomParamInputHandler {
  handle = async (message, context) => {
    // Проверяем, есть ли текст в сообщении
    if (!message.text) {
      return null;
    }
    
    // Проверяем, является ли текст числом (целым или с плавающей точкой)
    const inputText = message.text.trim();
    const isNumber = /^-?\d+(\.\d+)?$/.test(inputText);
    
    if (!isNumber) {
      return null;
    }
    
    // Проверяем, ожидается ли ввод значения параметра
    const editParamKey = `edit_param:${message.chat.id}`;
    let paramInfo;
    
    try {
      const paramInfoStr = await ENV.DATABASE.get(editParamKey);
      if (!paramInfoStr) {
        return null;
      }
      
      paramInfo = JSON.parse(paramInfoStr);
    } catch (e) {
      console.error("Error getting param info:", e);
      return null;
    }
    
    // Если нашли информацию о редактируемом параметре
    if (paramInfo) {
      const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
      
      try {
        // Преобразуем введенное значение в соответствующий тип
        let typedValue;
        
        switch(paramInfo.paramName) {
          case "temperature":
          case "top_p":
            typedValue = parseFloat(inputText);
            break;
          case "max_tokens":
          case "top_k":
            typedValue = parseInt(inputText);
            break;
          default:
            typedValue = inputText;
        }
        
        // Проверяем валидность значения
        if (paramInfo.paramName === "temperature" && (typedValue < 0 || typedValue > 2)) {
          return sender.sendPlainText("Ошибка: значение температуры должно быть в диапазоне от 0 до 2");
        }
        
        if (paramInfo.paramName === "top_p" && (typedValue < 0 || typedValue > 1)) {
          return sender.sendPlainText("Ошибка: значение top_p должно быть в диапазоне от 0 до 1");
        }
        
        if ((paramInfo.paramName === "max_tokens" || paramInfo.paramName === "top_k") && typedValue < 0) {
          return sender.sendPlainText(`Ошибка: значение ${paramInfo.paramName} не может быть отрицательным`);
        }
        
        // Сохраняем значение в конфигурации
        await context.execChangeAndSave({ [paramInfo.configKey]: typedValue });
        
        // Удаляем информацию о редактируемом параметре
        await ENV.DATABASE.delete(editParamKey);
        
        // Отправляем сообщение об успешном сохранении
        await sender.sendPlainText(`Значение параметра ${paramInfo.paramName} успешно изменено на ${typedValue}`);
        
        // Обновляем сообщение с параметрами модели
        const modelParamsHandler = new ModelParamsCommandHandler();
        const keyboard = modelParamsHandler.createParamsKeyboard(context.USER_CONFIG);
        
        const params = {
          chat_id: message.chat.id,
          message_id: paramInfo.messageId,
          text: `${ENV.I18N.callback_query.params_saved}\nПараметры модели:`,
          reply_markup: {
            inline_keyboard: keyboard
          }
        };
        
        return sender.editRawMessage(params);
      } catch (e) {
        console.error("Error setting param value:", e);
        return sender.sendPlainText(`Ошибка при установке значения: ${e.message}`);
      }
    }
    
    return null;
  };
}

export const SHARE_HANDLER = [
  new EnvChecker(),
  new WhiteListFilter(),
  new CallbackQueryHandler(),
  new Update2MessageHandler([
    new MessageFilter(),
    new GroupMention(),
    new OldMessageFilter(),
    new SaveLastMessage(),
    new CustomParamInputHandler(), // Добавляем наш новый обработчик перед CommandHandler
    new CommandHandler(),
    new ChatHandler()
  ])
];

export async function handleUpdate(token, update) {
  const context = await WorkerContext.from(token, update);
  for (const handler of SHARE_HANDLER) {
    try {
      const result = await handler.handle(update, context);
      if (result) {
        return result;
      }
    } catch (e) {
      return new Response(JSON.stringify({
        message: e.message,
        stack: e.stack
      }), { status: 500 });
    }
  }
  return null;
}
