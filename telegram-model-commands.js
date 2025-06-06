// telegram-model-commands.js - Команды для работы с моделями

import {
  ENV
} from './config.js';

import {
  MessageSender
} from './api.js';

import {
  loadChatLLM
} from './ai-providers.js';

export class ModelsCommandHandler {
  command = "/models";
  scopes = ["all_private_chats", "all_group_chats", "all_chat_administrators"];
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    const chatAgent = loadChatLLM(context.USER_CONFIG);

    // Получаем список моделей с ценами через OpenRouter API
    const apiKey = context.USER_CONFIG.OPENAI_API_KEY[0];
    const url = `${context.USER_CONFIG.OPENAI_API_BASE.replace(/\/+$/, "")}/models`;
    const resp = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });
    const data = await resp.json();
    const models = data.data || [];

    // Группировка по провайдеру
    const grouped = {};
    for (const model of models) {
      let provider = model.provider;
      if (!provider) {
        // Пробуем извлечь провайдера из id (например, openai/gpt-4.1)
        if (typeof model.id === "string" && model.id.includes("/")) {
          provider = model.id.split("/")[0];
        } else {
          provider = "other";
        }
      }
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push(model);
    }

    // Сохраняем модели в глобальном кеше для доступа из обработчика callback_query
    if (!globalThis.openRouterModels) {
      globalThis.openRouterModels = {};
    }
    globalThis.openRouterModels = grouped;
    
    // Создаем клавиатуру с кнопками провайдеров
    const keyboard = [];
    // Список приоритетных провайдеров, которые будут отображаться первыми
    const priorityProviders = ['openai', 'anthropic', 'google', 'deepseek'];
    
    // Разделяем провайдеров на приоритетные и обычные
    const priorityProvidersList = [];
    const regularProvidersList = [];
    
    Object.keys(grouped).forEach(provider => {
      if (priorityProviders.includes(provider.toLowerCase())) {
        priorityProvidersList.push(provider);
      } else {
        regularProvidersList.push(provider);
      }
    });
    
    // Сортируем каждую группу провайдеров по алфавиту
    priorityProvidersList.sort((a, b) => a.localeCompare(b));
    regularProvidersList.sort((a, b) => a.localeCompare(b));
    
    // Объединяем списки, сначала приоритетные, потом обычные
    const providers = [...priorityProvidersList, ...regularProvidersList];
    
    // Визуально отделяем приоритетных провайдеров
    if (priorityProvidersList.length > 0) {
      // Создаем кнопки для приоритетных провайдеров
      for (let i = 0; i < priorityProvidersList.length; i += 2) {
        const row = [];
        
        // Первый провайдер в ряду
        if (i < priorityProvidersList.length) {
          const providerName = priorityProvidersList[i];
          const modelCount = grouped[providerName].length;
          row.push({
            text: `★ ${providerName} (${modelCount})`,
            callback_data: `provider:${providerName}:1` // 1 - страница
          });
        }
        
        // Второй провайдер в ряду (если есть)
        if (i + 1 < priorityProvidersList.length) {
          const providerName = priorityProvidersList[i + 1];
          const modelCount = grouped[providerName].length;
          row.push({
            text: `★ ${providerName} (${modelCount})`,
            callback_data: `provider:${providerName}:1` // 1 - страница
          });
        }
        
        keyboard.push(row);
      }
      
      // Добавляем разделитель между приоритетными и обычными провайдерами
      if (regularProvidersList.length > 0) {
        keyboard.push([{
          text: "───────────────────",
          callback_data: "noop"
        }]);
      }
    }
    
    // Создаем кнопки для обычных провайдеров
    for (let i = 0; i < regularProvidersList.length; i += 2) {
      const row = [];
      
      // Первый провайдер в ряду
      if (i < regularProvidersList.length) {
        const providerName = regularProvidersList[i];
        const modelCount = grouped[providerName].length;
        row.push({
          text: `${providerName} (${modelCount})`,
          callback_data: `provider:${providerName}:1` // 1 - страница
        });
      }
      
      // Второй провайдер в ряду (если есть)
      if (i + 1 < regularProvidersList.length) {
        const providerName = regularProvidersList[i + 1];
        const modelCount = grouped[providerName].length;
        row.push({
          text: `${providerName} (${modelCount})`,
          callback_data: `provider:${providerName}:1` // 1 - страница
        });
      }
      
      keyboard.push(row);
    }

    // Отправляем сообщение с кнопками
    const params = {
      chat_id: message.chat.id,
      text: "Выберите провайдера моделей:",
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
    
    return sender.sendRawMessage(params);
  };
  
  // Метод для создания клавиатуры с моделями (используется в обработчике callback_query)
  createKeyboard(models, providerName, page) {
    const keyboard = [];
    
    // Функция для форматирования цены за 1 миллион токенов
    function formatPerMillionTokens(price) {
      if (price === 0 || price === "0") {
        return "free";
      }
      
      const numPrice = Number(price);
      if (isNaN(numPrice)) {
        return "-";
      }
      
      // Умножаем на 1,000,000 для получения цены за 1 млн токенов
      const perMillionPrice = numPrice * 1000000;
      
      // Форматируем с двумя знаками после запятой для читаемости
      if (perMillionPrice < 0.01) {
        return perMillionPrice.toFixed(4);
      } else if (perMillionPrice < 1) {
        return perMillionPrice.toFixed(2);
      } else {
        // Для больших чисел округляем до целого
        return Math.round(perMillionPrice).toString();
      }
    }
    
    // Функция для получения цен
    function getModelPrices(model) {
      let priceIn = "-";
      let priceOut = "-";
      
      if (model.id && model.id.includes(":free")) {
        priceIn = "free";
        priceOut = "free";
      }
      else if (model.pricing && typeof model.pricing === "object") {
        if (model.pricing.prompt !== undefined) {
          priceIn = formatPerMillionTokens(model.pricing.prompt);
        } else if (model.pricing.input !== undefined) {
          priceIn = formatPerMillionTokens(model.pricing.input);
        } else if (model.pricing.usage !== undefined) {
          priceIn = formatPerMillionTokens(model.pricing.usage);
        }
        
        if (model.pricing.completion !== undefined) {
          priceOut = formatPerMillionTokens(model.pricing.completion);
        } else if (model.pricing.output !== undefined) {
          priceOut = formatPerMillionTokens(model.pricing.output);
        } else if (model.pricing.usage !== undefined && priceIn === "-") {
          priceOut = formatPerMillionTokens(model.pricing.usage);
        }
      }
      
      return { priceIn, priceOut };
    }
    
    const pageSize = 20; // Количество моделей на странице
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, models.length);
    
    // Формируем кнопки для каждой модели
    for (let i = startIndex; i < endIndex; i++) {
      const model = models[i];
      const { priceIn, priceOut } = getModelPrices(model);
      const modelId = model.id.replace(`${providerName}/`, ''); // Убираем префикс провайдера для краткости
      
      // Показываем имя модели и цены в кнопке
      const buttonText = `${modelId} (${priceIn}/${priceOut})`;
      
      keyboard.push([{
        text: buttonText,
        callback_data: `setModel:openai:${model.id}` // callback для выбора модели
      }]);
    }
    
    // Кнопки навигации
    const totalPages = Math.ceil(models.length / pageSize);
    const navigationButtons = [];
    
    // Кнопка "Назад" для навигации по страницам
    if (page > 1) {
      navigationButtons.push({
        text: "< Назад",
        callback_data: `provider:${providerName}:${page - 1}`
      });
    }
    
    // Кнопка со счетчиком страниц
    navigationButtons.push({
      text: `${page}/${totalPages}`,
      callback_data: `noop` // Пустое действие, просто для отображения
    });
    
    // Кнопка "Вперед" для навигации по страницам
    if (page < totalPages) {
      navigationButtons.push({
        text: "Вперед >",
        callback_data: `provider:${providerName}:${page + 1}`
      });
    }
    
    // Кнопка "Назад к списку провайдеров"
    navigationButtons.push({
      text: "⇤ К провайдерам",
      callback_data: `modellist`
    });
    
    keyboard.push(navigationButtons);
    
    return keyboard;
  }
}

export class ModelParamsCommandHandler {
  command = "/modelparams";
  scopes = ["all_private_chats", "all_group_chats", "all_chat_administrators"];
  
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    
    // Создаем клавиатуру с параметрами модели
    const keyboard = this.createParamsKeyboard(context.USER_CONFIG);
    
    const params = {
      chat_id: message.chat.id,
      text: "Параметры модели:",
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
    
    return sender.sendRawMessage(params);
  };
  
  createParamsKeyboard(config) {
    const keyboard = [];
    
    // Температура
    keyboard.push([{
      text: `${ENV.I18N.callback_query.temperature}: ${config.TEMPERATURE}`,
      callback_data: `param:temperature:${config.TEMPERATURE}`
    }]);
    
    // Максимальное количество токенов
    keyboard.push([{
      text: `${ENV.I18N.callback_query.max_tokens}: ${config.MAX_TOKENS}`,
      callback_data: `param:max_tokens:${config.MAX_TOKENS}`
    }]);
    
    // Top K
    keyboard.push([{
      text: `${ENV.I18N.callback_query.top_k}: ${config.TOP_K}`,
      callback_data: `param:top_k:${config.TOP_K}`
    }]);
    
    // Top P
    keyboard.push([{
      text: `${ENV.I18N.callback_query.top_p}: ${config.TOP_P}`,
      callback_data: `param:top_p:${config.TOP_P}`
    }]);
    
    // Поиск в интернете
    const isOnlineStatus = config.IS_ONLINE ?
      ENV.I18N.callback_query.enabled :
      ENV.I18N.callback_query.disabled;
    
    keyboard.push([{
      text: `${ENV.I18N.callback_query.is_online}: ${isOnlineStatus}`,
      callback_data: `param:is_online:${config.IS_ONLINE}`
    }]);
    
    // Кэширование
    const cachingStatus = config.ENABLE_CACHING ?
      ENV.I18N.callback_query.enabled :
      ENV.I18N.callback_query.disabled;
    
    keyboard.push([{
      text: `${ENV.I18N.callback_query.enable_caching}: ${cachingStatus}`,
      callback_data: `param:enable_caching:${config.ENABLE_CACHING}`
    }]);
    
    return keyboard;
  }
}