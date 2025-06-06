// telegram-commands.js - Базовые команды Telegram

import {
  ENV,
  ConfigMerger
} from './config.js';

import {
  createTelegramBotAPI,
  MessageSender,
  TELEGRAM_AUTH_CHECKER,
  isGroupChat,
  loadChatRoleWithContext
} from './api.js';

export class HelpCommandHandler {
  command = "/help";
  scopes = ["all_private_chats", "all_chat_administrators"];
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    let helpMsg = `${ENV.I18N.command.help.summary}
`;
    for (const [k, v] of Object.entries(ENV.I18N.command.help)) {
      if (k === "summary") {
        continue;
      }
      helpMsg += `/${k}：${v}
`;
    }
    for (const [k, v] of Object.entries(ENV.CUSTOM_COMMAND)) {
      if (v.description) {
        helpMsg += `${k}：${v.description}
`;
      }
    }
    for (const [k, v] of Object.entries(ENV.PLUGINS_COMMAND)) {
      if (v.description) {
        helpMsg += `${k}：${v.description}
`;
      }
    }
    return sender.sendPlainText(helpMsg);
  };
}

export class BaseNewCommandHandler {
  static async handle(showID, message, subcommand, context) {
    await ENV.DATABASE.delete(context.SHARE_CONTEXT.chatHistoryKey);
    const text = ENV.I18N.command.new.new_chat_start + (showID ? `(${message.chat.id})` : "");
    const params = {
      chat_id: message.chat.id,
      text
    };
    if (ENV.SHOW_REPLY_BUTTON && !isGroupChat(message.chat.type)) {
      params.reply_markup = {
        keyboard: [[{ text: "/new" }, { text: "/redo" }]],
        selective: true,
        resize_keyboard: true,
        one_time_keyboard: false
      };
    } else {
      params.reply_markup = {
        remove_keyboard: true,
        selective: true
      };
    }
    return createTelegramBotAPI(context.SHARE_CONTEXT.botToken).sendMessage(params);
  }
}

export class NewCommandHandler extends BaseNewCommandHandler {
  command = "/new";
  scopes = ["all_private_chats", "all_group_chats", "all_chat_administrators"];
  handle = async (message, subcommand, context) => {
    return BaseNewCommandHandler.handle(false, message, subcommand, context);
  };
}

export class StartCommandHandler extends BaseNewCommandHandler {
  command = "/start";
  handle = async (message, subcommand, context) => {
    return BaseNewCommandHandler.handle(true, message, subcommand, context);
  };
}

export class RedoCommandHandler {
  command = "/redo";
  scopes = ["all_private_chats", "all_group_chats", "all_chat_administrators"];
  handle = async (message, subcommand, context) => {
    const mf = (history, message2) => {
      let nextMessage = message2;
      if (!(history && Array.isArray(history) && history.length > 0)) {
        throw new Error("History not found");
      }
      const historyCopy = structuredClone(history);
      while (true) {
        const data = historyCopy.pop();
        if (data === undefined || data === null) {
          break;
        } else if (data.role === "user") {
          nextMessage = data;
          break;
        }
      }
      if (subcommand) {
        nextMessage = {
          role: "user",
          content: subcommand
        };
      }
      if (nextMessage === null) {
        throw new Error("Redo message not found");
      }
      return { history: historyCopy, message: nextMessage };
    };
    
    // Динамический импорт для избежания циклических зависимостей
    const { chatWithMessage } = await import('./message-handlers.js');
    return chatWithMessage(message, null, context, mf);
  };
}

export class EchoCommandHandler {
  command = "/echo";
  handle = (message, subcommand, context) => {
    let msg = "<pre>";
    msg += JSON.stringify({ message }, null, 2);
    msg += "</pre>";
    return MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message).sendRichText(msg, "HTML");
  };
}

export class UpdateMenuCommandHandler {
  command = "/updatemenu";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    
    try {
      const api = createTelegramBotAPI(context.SHARE_CONTEXT.botToken);
      
      // Создаем минимальный набор команд для меню
      const commands = [
        { command: "/help", description: ENV.I18N.command.help.help || "Получить справку" },
        { command: "/new", description: ENV.I18N.command.help.new || "Начать новый разговор" },
        { command: "/models", description: ENV.I18N.command.help.models || "Выбрать модель чата" },
        { command: "/modelparams", description: ENV.I18N.command.help.modelparams || "Настроить параметры модели" }
      ];
      
      // Устанавливаем команды напрямую для всех типов чатов
      const results = {};
      
      // Для приватных чатов
      results.private = await api.setMyCommands({
        commands: commands,
        scope: { type: "all_private_chats" }
      }).then(res => res.json()).catch(e => errorToString(e));
      
      // Для групповых чатов
      results.group = await api.setMyCommands({
        commands: commands,
        scope: { type: "all_group_chats" }
      }).then(res => res.json()).catch(e => errorToString(e));
      
      // Для администраторов чатов
      results.admin = await api.setMyCommands({
        commands: commands,
        scope: { type: "all_chat_administrators" }
      }).then(res => res.json()).catch(e => errorToString(e));
      
      // Формируем отчет о результатах
      let resultText = "Меню бота обновлено:\n";
      for (const [scope, result] of Object.entries(results)) {
        resultText += `${scope}: ${result.ok ? "успешно" : "ошибка"}\n`;
      }
      
      return sender.sendPlainText(resultText);
    } catch (e) {
      return sender.sendPlainText(`Ошибка при обновлении меню бота: ${e.message}`);
    }
  };
}

export function errorToString(e) {
  return JSON.stringify({
    message: e.message,
    stack: e.stack
  });
}