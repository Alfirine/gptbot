// callback-handlers.js - Обработчики callback-запросов

import {
  ENV
} from './config.js';

import {
  createTelegramBotAPI,
  MessageSender,
  TELEGRAM_AUTH_CHECKER,
  loadChatRoleWithContext
} from './api.js';

import {
  CHAT_AGENTS,
  loadChatLLM
} from './ai-providers.js';

import {
  ModelsCommandHandler,
  ModelParamsCommandHandler
} from './telegram-model-commands.js';

export class AgentListCallbackQueryHandler {
  prefix;
  changeAgentPrefix;
  agentLoader;
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  constructor(prefix, changeAgentPrefix, agentLoader) {
    this.prefix = prefix;
    this.changeAgentPrefix = changeAgentPrefix;
    this.agentLoader = agentLoader;
    this.createKeyboard = this.createKeyboard.bind(this);
  }
  static Chat() {
    return new AgentListCallbackQueryHandler("al:", "ca:", () => {
      return CHAT_AGENTS.filter((agent) => agent.enable(ENV.USER_CONFIG)).map((agent) => agent.name);
    });
  }
  handle = async (query, data, context) => {
    const names = this.agentLoader();
    const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
    const params = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: ENV.I18N.callback_query.select_provider,
      reply_markup: {
        inline_keyboard: this.createKeyboard(names)
      }
    };
    return sender.editRawMessage(params);
  };
  createKeyboard(names) {
    const keyboards = [];
    for (let i = 0; i < names.length; i += 2) {
      const row = [];
      for (let j = 0; j < 2; j++) {
        const index = i + j;
        if (index >= names.length) {
          break;
        }
        row.push({
          text: names[index],
          callback_data: `${this.changeAgentPrefix}${JSON.stringify([names[index], 0])}`
        });
      }
      keyboards.push(row);
    }
    return keyboards;
  }
}

export function changeChatAgentType(conf, agent) {
  return {
    ...conf,
    AI_PROVIDER: agent
  };
}

export function loadAgentContext(query, data, context, prefix, agentLoader, changeAgentType) {
  if (!query.message) {
    throw new Error("no message");
  }
  const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
  const params = JSON.parse(data.substring(prefix.length));
  const agent = Array.isArray(params) ? params.at(0) : null;
  if (!agent) {
    throw new Error(`agent not found: ${agent}`);
  }
  const conf = changeAgentType(ENV.USER_CONFIG, agent);
  const theAgent = agentLoader(conf);
  if (!theAgent?.modelKey) {
    throw new Error(`modelKey not found: ${agent}`);
  }
  return { sender, params, agent: theAgent, conf };
}

export class ModelListCallbackQueryHandler {
  prefix;
  agentListPrefix;
  changeModelPrefix;
  agentLoader;
  changeAgentType;
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  constructor(prefix, agentListPrefix, changeModelPrefix, agentLoader, changeAgentType) {
    this.prefix = prefix;
    this.agentListPrefix = agentListPrefix;
    this.changeModelPrefix = changeModelPrefix;
    this.agentLoader = agentLoader;
    this.changeAgentType = changeAgentType;
    this.createKeyboard = this.createKeyboard.bind(this);
  }
  static Chat() {
    return new ModelListCallbackQueryHandler("ca:", "al:", "cm:", loadChatLLM, changeChatAgentType);
  }
  async handle(query, data, context) {
    const { sender, params, agent: theAgent, conf } = loadAgentContext(query, data, context, this.prefix, this.agentLoader, this.changeAgentType);
    const [agent, page] = params;
    const models = await theAgent.modelList(conf);
    const message = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: `${agent} | ${ENV.I18N.callback_query.select_model}`,
      reply_markup: {
        inline_keyboard: await this.createKeyboard(models, agent, page)
      }
    };
    return sender.editRawMessage(message);
  }
  async createKeyboard(models, agent, page) {
    const keyboard = [];
    const maxRow = 10;
    const maxCol = Math.max(1, Math.min(5, ENV.MODEL_LIST_COLUMNS));
    const maxPage = Math.ceil(models.length / maxRow / maxCol);
    let currentRow = [];
    for (let i = page * maxRow * maxCol; i < models.length; i++) {
      currentRow.push({
        text: models[i],
        callback_data: `${this.changeModelPrefix}${JSON.stringify([agent, models[i]])}`
      });
      if (i % maxCol === 0) {
        keyboard.push(currentRow);
        currentRow = [];
      }
      if (keyboard.length >= maxRow) {
        break;
      }
    }
    if (currentRow.length > 0) {
      keyboard.push(currentRow);
      currentRow = [];
    }
    keyboard.push([
      {
        text: "<",
        callback_data: `${this.prefix}${JSON.stringify([agent, Math.max(page - 1, 0)])}`
      },
      {
        text: `${page + 1}/${maxPage}`,
        callback_data: `${this.prefix}${JSON.stringify([agent, page])}`
      },
      {
        text: ">",
        callback_data: `${this.prefix}${JSON.stringify([agent, Math.min(page + 1, maxPage - 1)])}`
      },
      {
        text: "⇤",
        callback_data: this.agentListPrefix
      }
    ]);
    if (models.length > (page + 1) * maxRow * maxCol) {
      currentRow.push();
    }
    keyboard.push(currentRow);
    return keyboard;
  }
}

export function changeChatAgentModel(agent, modelKey, model) {
  return {
    AI_PROVIDER: agent,
    [modelKey]: model
  };
}

export class ModelChangeCallbackQueryHandler {
  prefix;
  agentLoader;
  changeAgentType;
  createAgentChange;
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  constructor(prefix, agentLoader, changeAgentType, createAgentChange) {
    this.prefix = prefix;
    this.agentLoader = agentLoader;
    this.changeAgentType = changeAgentType;
    this.createAgentChange = createAgentChange;
  }
  static Chat() {
    return new ModelChangeCallbackQueryHandler("cm:", loadChatLLM, changeChatAgentType, changeChatAgentModel);
  }
  async handle(query, data, context) {
    const { sender, params, agent: theAgent } = loadAgentContext(query, data, context, this.prefix, this.agentLoader, this.changeAgentType);
    const [agent, model] = params;
    await context.execChangeAndSave(this.createAgentChange(agent, theAgent.modelKey, model));
    console.log("Change model:", agent, model);
    const message = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: `${ENV.I18N.callback_query.change_model} ${agent} > ${model}`
    };
    return sender.editRawMessage(message);
  }
}

export class SetModelCallbackQueryHandler {
  prefix = "setModel:";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;

  handle = async (query, data, context) => {
    const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
    const [_, agentName, modelName] = data.split(":");

    const chatAgent = CHAT_AGENTS.find(agent => agent.name === agentName);

    if (!chatAgent) {
      return sender.sendPlainText(`ERROR: Agent ${agentName} not found`);
    }

    const change = {};
    change[chatAgent.modelKey] = modelName;
    change["AI_PROVIDER"] = agentName // Устанавливаем AI_PROVIDER

    await context.execChangeAndSave(change);

    const message = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: `Модель изменена на ${agentName} > ${modelName}`
    };
    return sender.editRawMessage(message);
  };
}

export class ShowModelListCallbackQueryHandler {
  prefix = "modelList:";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;

  handle = async (query, data, context) => {
    const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
    const [_, agentName, pageStr] = data.split(":");
    const page = parseInt(pageStr, 10);

    const chatAgent = CHAT_AGENTS.find(agent => agent.name === agentName);

    if (!chatAgent) {
      return sender.sendPlainText(`ERROR: Agent ${agentName} not found`);
    }

    const models = await chatAgent.modelList(context.USER_CONFIG);
    const keyboard = this.createKeyboard(models, agentName, page);
    const params = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: `Выберите модель для ${agentName}:`,
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
    return sender.editRawMessage(params);
  };
}

export class ProviderModelsCallbackQueryHandler {
  prefix = "provider:";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  
  handle = async (query, data, context) => {
    const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
    const [_, providerName, pageStr] = data.split(":");
    const page = parseInt(pageStr, 10);
    
    // Проверяем, есть ли данные о моделях в глобальном кеше
    if (!globalThis.openRouterModels || !globalThis.openRouterModels[providerName]) {
      return sender.sendPlainText(`ERROR: Данные для провайдера ${providerName} не найдены`);
    }
    
    const models = globalThis.openRouterModels[providerName];
    
    // Создаем клавиатуру и отправляем сообщение
    const modelsHandler = new ModelsCommandHandler();
    const keyboard = modelsHandler.createKeyboard(models, providerName, page);
    
    const messageParams = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: `Модели провайдера ${providerName}:`,
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
    
    return sender.editRawMessage(messageParams);
  };
}

export class BackToProvidersCallbackQueryHandler {
  prefix = "modellist";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  
  handle = async (query, data, context) => {
    const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
    
    // Проверяем, есть ли данные о моделях в глобальном кеше
    if (!globalThis.openRouterModels) {
      return sender.sendPlainText(`ERROR: Данные о провайдерах не найдены`);
    }
    
    // Создаем клавиатуру с провайдерами
    const keyboard = [];
    // Список приоритетных провайдеров для отображения вверху списка
    const priorityProviders = ['openai', 'anthropic', 'google', 'deepseek'];
    
    // Сортировка с учетом приоритета
    const providers = Object.keys(globalThis.openRouterModels).sort((a, b) => {
      const aIsPriority = priorityProviders.includes(a.toLowerCase());
      const bIsPriority = priorityProviders.includes(b.toLowerCase());
      
      if (aIsPriority && !bIsPriority) return -1; // a приоритетный, b нет
      if (!aIsPriority && bIsPriority) return 1;  // b приоритетный, a нет
      return a.localeCompare(b); // стандартная сортировка для остальных
    });
    
    for (let i = 0; i < providers.length; i += 2) {
      const row = [];
      if (i < providers.length) {
        const providerName = providers[i];
        const modelCount = globalThis.openRouterModels[providerName].length;
        const isPriority = priorityProviders.includes(providerName.toLowerCase());
        const buttonText = `${isPriority ? "★ " : ""}${providerName} (${modelCount})`;
        
        row.push({
          text: buttonText,
          callback_data: `provider:${providerName}:1`
        });
      }
      if (i + 1 < providers.length) {
        const providerName = providers[i + 1];
        const modelCount = globalThis.openRouterModels[providerName].length;
        const isPriority = priorityProviders.includes(providerName.toLowerCase());
        const buttonText = `${isPriority ? "★ " : ""}${providerName} (${modelCount})`;
        
        row.push({
          text: buttonText,
          callback_data: `provider:${providerName}:1`
        });
      }
      keyboard.push(row);
    }
    
    const messageParams = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: "Выберите провайдера моделей:",
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
    
    return sender.editRawMessage(messageParams);
  };
}

export class NoopCallbackQueryHandler {
  prefix = "noop";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  
  handle = async (query, data, context) => {
    const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
    return sender.api.answerCallbackQuery({
      callback_query_id: query.id,
      text: "Это информационная кнопка"
    });
  };
}

export class ModelParamChangeCallbackQueryHandler {
  prefix = "param:";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  
  handle = async (query, data, context) => {
    const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
    const [_, paramName, currentValue] = data.split(":");
    
    // Создаем клавиатуру с вариантами значений в зависимости от параметра
    let keyboard = [];
    
    switch(paramName) {
      case "temperature":
        keyboard = this.createTemperatureKeyboard();
        break;
      case "max_tokens":
        keyboard = this.createMaxTokensKeyboard();
        break;
      case "top_k":
        keyboard = this.createTopKKeyboard();
        break;
      case "top_p":
        keyboard = this.createTopPKeyboard();
        break;
      case "is_online":
      case "enable_caching":
        keyboard = this.createBooleanKeyboard(paramName, currentValue === "true");
        break;
    }
    
    const params = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: `Выберите значение для параметра ${this.getParamDisplayName(paramName)}:`,
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
    
    return sender.editRawMessage(params);
  };
  
  getParamDisplayName(paramName) {
    switch(paramName) {
      case "temperature": return ENV.I18N.callback_query.temperature;
      case "max_tokens": return ENV.I18N.callback_query.max_tokens;
      case "top_k": return ENV.I18N.callback_query.top_k;
      case "top_p": return ENV.I18N.callback_query.top_p;
      case "is_online": return ENV.I18N.callback_query.is_online;
      case "enable_caching": return ENV.I18N.callback_query.enable_caching;
      default: return paramName;
    }
  }
  
  createTemperatureKeyboard() {
    const values = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    return this.createValueKeyboard("temperature", values, true);
  }
  
  createMaxTokensKeyboard() {
    const values = [500, 1000, 2000, 4000, 8000, 16000];
    return this.createValueKeyboard("max_tokens", values, true);
  }
  
  createTopKKeyboard() {
    const values = [0, 10, 20, 30, 40, 50, 60];
    return this.createValueKeyboard("top_k", values, true);
  }
  
  createTopPKeyboard() {
    const values = [0.1, 0.3, 0.5, 0.7, 0.9, 1.0];
    return this.createValueKeyboard("top_p", values, true);
  }
  
  createValueKeyboard(paramName, values, addCustomOption = false) {
    const keyboard = [];
    const rowSize = 3; // Количество кнопок в ряду
    
    for (let i = 0; i < values.length; i += rowSize) {
      const row = [];
      for (let j = 0; j < rowSize && i + j < values.length; j++) {
        const value = values[i + j];
        row.push({
          text: `${value}`,
          callback_data: `setparam:${paramName}:${value}`
        });
      }
      keyboard.push(row);
    }
    
    // Добавляем кнопку для ввода своего значения
    if (addCustomOption) {
      keyboard.push([{
        text: "✏️ Ввести своё значение",
        callback_data: `custom:${paramName}`
      }]);
    }
    
    // Добавляем кнопку "Назад"
    keyboard.push([{
      text: "⇤ Назад",
      callback_data: "modelparams"
    }]);
    
    return keyboard;
  }
  
  createBooleanKeyboard(paramName, currentValue) {
    return [
      [
        {
          text: ENV.I18N.callback_query.enabled,
          callback_data: `setparam:${paramName}:true`
        },
        {
          text: ENV.I18N.callback_query.disabled,
          callback_data: `setparam:${paramName}:false`
        }
      ],
      [
        {
          text: "⇤ Назад",
          callback_data: "modelparams"
        }
      ]
    ];
  }
}

export class SetModelParamCallbackQueryHandler {
  prefix = "setparam:";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  
  handle = async (query, data, context) => {
    const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
    const [_, paramName, value] = data.split(":");
    
    // Преобразуем значение в соответствующий тип
    let typedValue;
    switch(paramName) {
      case "temperature":
      case "top_p":
        typedValue = parseFloat(value);
        break;
      case "max_tokens":
      case "top_k":
        typedValue = parseInt(value);
        break;
      case "is_online":
      case "enable_caching":
        typedValue = value === "true";
        break;
      default:
        typedValue = value;
    }
    
    // Преобразуем имя параметра в имя поля конфигурации
    const configKey = this.getConfigKey(paramName);
    
    // Сохраняем значение в конфигурации
    await context.execChangeAndSave({ [configKey]: typedValue });
    
    // Создаем обновленную клавиатуру с параметрами
    const modelParamsHandler = new ModelParamsCommandHandler();
    const keyboard = modelParamsHandler.createParamsKeyboard(context.USER_CONFIG);
    
    const params = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: `${ENV.I18N.callback_query.params_saved}\nПараметры модели:`,
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
    
    return sender.editRawMessage(params);
  };
  
  getConfigKey(paramName) {
    switch(paramName) {
      case "temperature": return "TEMPERATURE";
      case "max_tokens": return "MAX_TOKENS";
      case "top_k": return "TOP_K";
      case "top_p": return "TOP_P";
      case "is_online": return "IS_ONLINE";
      case "enable_caching": return "ENABLE_CACHING";
      default: return paramName.toUpperCase();
    }
  }
}

export class BackToModelParamsCallbackQueryHandler {
  prefix = "modelparams";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  
  handle = async (query, data, context) => {
    const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
    
    // Создаем клавиатуру с параметрами
    const modelParamsHandler = new ModelParamsCommandHandler();
    const keyboard = modelParamsHandler.createParamsKeyboard(context.USER_CONFIG);
    
    const params = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: "Параметры модели:",
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
    
    return sender.editRawMessage(params);
  };
}

export async function handleCallbackQuery(callbackQuery, context) {
  const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, callbackQuery);
  const answerCallbackQuery = (msg) => {
    return sender.api.answerCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: msg
    });
  };
  try {
    if (!callbackQuery.message) {
      return null;
    }
    const chatId = callbackQuery.message.chat.id;
    const speakerId = callbackQuery.from?.id || chatId;
    const chatType = callbackQuery.message.chat.type;
    for (const handler of QUERY_HANDLERS) {
      if (handler.needAuth) {
        const roleList = handler.needAuth(chatType);
        if (roleList) {
          const chatRole = await loadChatRoleWithContext(chatId, speakerId, context);
          if (chatRole === null) {
            return answerCallbackQuery("ERROR: Get chat role failed");
          }
          if (!roleList.includes(chatRole)) {
            return answerCallbackQuery(`ERROR: Permission denied, need ${roleList.join(" or ")}`);
          }
        }
      }
      if (callbackQuery.data) {
        if (callbackQuery.data.startsWith(handler.prefix)) {
          return handler.handle(callbackQuery, callbackQuery.data, context);
        }
      }
    }
  } catch (e) {
    console.error("handleCallbackQuery", e);
    return answerCallbackQuery(`ERROR: ${e.message}`);
  }
  return null;
}

// Обработчик для ввода пользовательского значения параметра
export class CustomParamInputCallbackQueryHandler {
  prefix = "custom:";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  
  handle = async (query, data, context) => {
    const sender = MessageSender.fromCallbackQuery(context.SHARE_CONTEXT.botToken, query);
    const [_, paramName] = data.split(":");
    
    // Получаем текущее значение параметра
    const configKey = this.getConfigKey(paramName);
    const currentValue = context.USER_CONFIG[configKey];
    
    // Сохраняем информацию о редактируемом параметре в базе данных
    const editParamKey = `edit_param:${query.message.chat.id}`;
    await ENV.DATABASE.put(editParamKey, JSON.stringify({
      paramName: paramName,
      configKey: configKey,
      chatId: query.message.chat.id,
      messageId: query.message.message_id
    }), { expirationTtl: 300 }); // Истекает через 5 минут
    
    // Создаем сообщение с инструкцией для ввода значения
    const params = {
      chat_id: query.message?.chat.id || 0,
      message_id: query.message?.message_id || 0,
      text: `Введите своё значение для параметра ${this.getParamDisplayName(paramName)}.\n\nТекущее значение: ${currentValue}\n\nПросто отправьте число в чат.`,
      reply_markup: {
        inline_keyboard: [[{
          text: "⇤ Назад к выбору значений",
          callback_data: `param:${paramName}:${currentValue}`
        }]]
      }
    };
    
    return sender.editRawMessage(params);
  };
  
  getParamDisplayName(paramName) {
    switch(paramName) {
      case "temperature": return ENV.I18N.callback_query.temperature;
      case "max_tokens": return ENV.I18N.callback_query.max_tokens;
      case "top_k": return ENV.I18N.callback_query.top_k;
      case "top_p": return ENV.I18N.callback_query.top_p;
      case "is_online": return ENV.I18N.callback_query.is_online;
      case "enable_caching": return ENV.I18N.callback_query.enable_caching;
      default: return paramName;
    }
  }
  
  getConfigKey(paramName) {
    switch(paramName) {
      case "temperature": return "TEMPERATURE";
      case "max_tokens": return "MAX_TOKENS";
      case "top_k": return "TOP_K";
      case "top_p": return "TOP_P";
      case "is_online": return "IS_ONLINE";
      case "enable_caching": return "ENABLE_CACHING";
      default: return paramName.toUpperCase();
    }
  }
  
  getExampleValue(paramName) {
    switch(paramName) {
      case "temperature": return "0.85";
      case "max_tokens": return "3000";
      case "top_k": return "45";
      case "top_p": return "0.95";
      default: return "value";
    }
  }
}

export const QUERY_HANDLERS = [
  AgentListCallbackQueryHandler.Chat(),
  ModelListCallbackQueryHandler.Chat(),
  ModelChangeCallbackQueryHandler.Chat(),
  new ShowModelListCallbackQueryHandler(),
  new SetModelCallbackQueryHandler(),
  new ProviderModelsCallbackQueryHandler(),
  new BackToProvidersCallbackQueryHandler(),
  new NoopCallbackQueryHandler(),
  new ModelParamChangeCallbackQueryHandler(),
  new SetModelParamCallbackQueryHandler(),
  new BackToModelParamsCallbackQueryHandler(),
  new CustomParamInputCallbackQueryHandler()
];