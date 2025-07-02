// config.js - Конфигурация и базовые классы

export class AgentShareConfig {
    AI_PROVIDER = "auto";
    AI_IMAGE_PROVIDER = "auto";
    SYSTEM_INIT_MESSAGE = null;
  }
  
export class OpenAIConfig {
    OPENAI_API_KEY = [];
    OPENAI_CHAT_MODEL = "gpt-4o-mini";
    OPENAI_API_BASE = "https://openrouter.ai/api/v1";
    OPENAI_API_EXTRA_PARAMS = {};
    OPENAI_CHAT_MODELS_LIST = "";
    OPENROUTER_IMAGE_MODEL = "stability/stable-diffusion-xl";
    DALL_E_IMAGE_SIZE = "1024x1024";
    // Параметры модели
    TEMPERATURE = 0.7;
    MAX_TOKENS = 1000;
    TOP_K = 40;
    TOP_P = 0.9;
    IS_ONLINE = false;
    ENABLE_CACHING = true;
  }
  
export class DefineKeys {
    DEFINE_KEYS = [];
  }
  
export class EnvironmentConfig {
    LANGUAGE = "ru-ru";
    UPDATE_BRANCH = "master";
    CHAT_COMPLETE_API_TIMEOUT = 30;
    TELEGRAM_API_DOMAIN = "https://api.telegram.org";
    TELEGRAM_AVAILABLE_TOKENS = [];
    DEFAULT_PARSE_MODE = "Markdown";
    TELEGRAM_MIN_STREAM_INTERVAL = 0;
    TELEGRAM_PHOTO_SIZE_OFFSET = 1;
    TELEGRAM_IMAGE_TRANSFER_MODE = "base64";
    MODEL_LIST_COLUMNS = 1;
    I_AM_A_GENEROUS_PERSON = false;
    CHAT_WHITE_LIST = [];
    LOCK_USER_CONFIG_KEYS = [
    ];
    GOOGLE_API_KEY = "AIzaSyB5G-UXdHdCiygQjsIUfkIUpOtdP_00X50";
    GOOGLE_SEARCH_ENGINE_ID = "71f00319f5b8d4ff5";
    BOT_MENU_COMMANDS = ["/help", "/new", "/models", "/modelparams", "/getsystemprompt"];
    TELEGRAM_BOT_NAME = [];
    CHAT_GROUP_WHITE_LIST = [];
    GROUP_CHAT_BOT_ENABLE = true;
    GROUP_CHAT_BOT_SHARE_MODE = true;
    AUTO_TRIM_HISTORY = true;
    MAX_HISTORY_LENGTH = 20;
    MAX_TOKEN_LENGTH = -1;
    HISTORY_IMAGE_PLACEHOLDER = null;
    HIDE_COMMAND_BUTTONS = [];
    SHOW_REPLY_BUTTON = false;
    EXTRA_MESSAGE_CONTEXT = false;
    EXTRA_MESSAGE_MEDIA_COMPATIBLE = ["image"];
    STREAM_MODE = true;
    SAFE_MODE = true;
    DEBUG_MODE = false;
    DEV_MODE = false;
  }
  
export const en = { "env": { "system_init_message": "You are a helpful assistant" }, "command": { "help": { "summary": "The following commands are currently supported:\n", "help": "Get command help", "new": "Start a new conversation", "start": "Get your ID and start a new conversation", "version": "Get the current version number to determine whether to update", "setenv": "Set user configuration, the complete command format is /setenv KEY=VALUE", "setenvs": 'Batch set user configurations, the full format of the command is /setenvs {"KEY1": "VALUE1", "KEY2": "VALUE2"}', "delenv": "Delete user configuration, the complete command format is /delenv KEY", "clearenv": "Clear all user configuration", "system": "View some system information", "redo": "Redo the last conversation, /redo with modified content or directly /redo", "echo": "Echo the message", "models": "switch chat model" }, "new": { "new_chat_start": "A new conversation has started" } }, "callback_query": { "open_model_list": "Open models list", "select_provider": "Select a provider:", "select_model": "Choose model:", "change_model": "Change model to " } };
export const ru = {
    "env": {
      "system_init_message": "Вы - полезный помощник"
    },
    "command": {
      "help": {
        "summary": "В настоящее время поддерживаются следующие команды:\n",
        "help": "Получить справку по команде",
        "new": "Начать новый разговор",
        "start": "Получить ваш ID и начать новый разговор",
        "version": "Получить текущий номер версии, чтобы определить, нужно ли обновление",
        "setenv": "Установить пользовательскую конфигурацию. Полный формат команды: /setenv КЛЮЧ=ЗНАЧЕНИЕ",
        "setenvs": 'Пакетная установка пользовательских конфигураций. Полный формат команды: /setenvs {"КЛЮЧ1": "ЗНАЧЕНИЕ1", "КЛЮЧ2": "ЗНАЧЕНИЕ2"}',
        "delenv": "Удалить пользовательскую конфигурацию. Полный формат команды: /delenv КЛЮЧ",
        "clearenv": "Очистить все пользовательские конфигурации",
        "system": "Просмотреть некоторую системную информацию",
        "redo": "Повторить последний разговор. /redo с измененным содержанием или просто /redo",
        "echo": "Эхо-повтор сообщения",
        "models": "выбрать модель чата",
        "modelparams": "настроить параметры модели",
        "updatemenu": "обновить меню команд бота",
        "setsystemprompt": "Установить системный промпт. Формат: /setsystemprompt ВАШЕ_СООБЩЕНИЕ",
        "getsystemprompt": "Показать текущий системный промпт",
        "clearsystemprompt": "Очистить системный промпт (вернуться к промпту по умолчанию)"
      },
      "new": {
        "new_chat_start": "Начат новый разговор"
      }
    },
    "callback_query": {
      "open_model_list": "Открыть список моделей",
      "select_model": "Выберите модель:",
      "change_model": "Модель изменена на ",
      "model_params": "Параметры модели",
      "temperature": "Температура",
      "max_tokens": "Максимальное количество токенов",
      "top_k": "Top K",
      "top_p": "Top P",
      "is_online": "Поиск в интернете",
      "enable_caching": "Кэширование",
      "enabled": "Включено",
      "disabled": "Выключено",
      "save_params": "Сохранить параметры",
      "params_saved": "Параметры сохранены"
    }
  };
export function loadI18n(lang) {
    switch (lang?.toLowerCase()) {
      case "ru":
      case "ru-ru":
        return ru;
      case "en":
      case "en-us":
        return en;
      default:
        return ru; // По умолчанию используем русскую локализацию
    }
  }
export class ConfigMerger {
    static parseArray(raw) {
      raw = raw.trim();
      if (raw === "") {
        return [];
      }
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          return JSON.parse(raw);
        } catch (e) {
          console.error(e);
        }
      }
      return raw.split(",");
    }
    static trim(source, lock) {
      const config = { ...source };
      const keysSet = new Set(source?.DEFINE_KEYS || []);
      for (const key of lock) {
        keysSet.delete(key);
      }
      keysSet.add("DEFINE_KEYS");
      for (const key of Object.keys(config)) {
        if (!keysSet.has(key)) {
          delete config[key];
        }
      }
      return config;
    }
    static merge(target, source, exclude) {
      const sourceKeys = new Set(Object.keys(source));
      for (const key of Object.keys(target)) {
        if (!sourceKeys.has(key)) {
          continue;
        }
        if (exclude && exclude.includes(key)) {
          continue;
        }
        const t = target[key] !== null && target[key] !== undefined ? typeof target[key] : "string";
        if (typeof source[key] !== "string") {
          target[key] = source[key];
          continue;
        }
        switch (t) {
          case "number":
            target[key] = Number.parseInt(source[key], 10);
            break;
          case "boolean":
            target[key] = (source[key] || "false") === "true";
            break;
          case "string":
            target[key] = source[key];
            break;
          case "object":
            if (Array.isArray(target[key])) {
              target[key] = ConfigMerger.parseArray(source[key]);
            } else {
              try {
                target[key] = JSON.parse(source[key]);
              } catch (e) {
                console.error(e);
              }
            }
            break;
          default:
            target[key] = source[key];
            break;
        }
      }
    }
  }
export const BUILD_TIMESTAMP = 1738739286;
export const BUILD_VERSION = "15e8e3c";

export function createAgentUserConfig() {
    return Object.assign(
      {},
      new DefineKeys(),
      new AgentShareConfig(),
      new OpenAIConfig()
    );
  }
export function fixApiBase(base) {
    return base.replace(/\/+$/, "");
  }
export const ENV_KEY_MAPPER = {
    CHAT_MODEL: "OPENAI_CHAT_MODEL",
    API_KEY: "OPENAI_API_KEY",
    WORKERS_AI_MODEL: "WORKERS_CHAT_MODEL"
  };
export class Environment extends EnvironmentConfig {
    BUILD_TIMESTAMP = BUILD_TIMESTAMP;
    BUILD_VERSION = BUILD_VERSION;
    I18N = loadI18n();
    PLUGINS_ENV = {};
    USER_CONFIG = createAgentUserConfig();
    CUSTOM_COMMAND = {};
    PLUGINS_COMMAND = {};
    AI_BINDING = null;
    API_GUARD = null;
    // Инициализируем DATABASE напрямую в коде
    DATABASE = {
      // Хранилище данных в памяти
      _store: new Map(),
      
      // Метод для получения данных
      async get(key) {
        console.log(`[DATABASE] Получение данных по ключу: ${key}`);
        return this._store.get(key);
      },
      
      // Метод для сохранения данных
      async put(key, value, options = {}) {
        console.log(`[DATABASE] Сохранение данных по ключу: ${key}`);
        this._store.set(key, value);
        return true;
      },
      
      // Метод для удаления данных
      async delete(key) {
        console.log(`[DATABASE] Удаление данных по ключу: ${key}`);
        return this._store.delete(key);
      }
    };
    CUSTOM_MESSAGE_RENDER = null;
    constructor() {
      super();
      this.merge = this.merge.bind(this);
    }
    merge(source) {
      this.AI_BINDING = source.AI;
      // Сохраняем нашу DATABASE даже если в source есть своя
      // this.DATABASE = source.DATABASE;
      this.API_GUARD = source.API_GUARD;
      this.mergeCommands(
        "CUSTOM_COMMAND_",
        "COMMAND_DESCRIPTION_",
        "COMMAND_SCOPE_",
        source,
        this.CUSTOM_COMMAND
      );
      this.mergeCommands(
        "PLUGIN_COMMAND_",
        "PLUGIN_DESCRIPTION_",
        "PLUGIN_SCOPE_",
        source,
        this.PLUGINS_COMMAND
      );
      const pluginEnvPrefix = "PLUGIN_ENV_";
      for (const key of Object.keys(source)) {
        if (key.startsWith(pluginEnvPrefix)) {
          const plugin = key.substring(pluginEnvPrefix.length);
          this.PLUGINS_ENV[plugin] = source[key];
        }
      }
      ConfigMerger.merge(this, source, [
        "BUILD_TIMESTAMP",
        "BUILD_VERSION",
        "I18N",
        "PLUGINS_ENV",
        "USER_CONFIG",
        "CUSTOM_COMMAND",
        "PLUGINS_COMMAND",
        "DATABASE",
        "API_GUARD"
      ]);
      ConfigMerger.merge(this.USER_CONFIG, source);
      this.migrateOldEnv(source);
      this.fixAgentUserConfigApiBase();
      this.USER_CONFIG.DEFINE_KEYS = [];
      this.I18N = loadI18n(this.LANGUAGE.toLowerCase());
    }
    mergeCommands(prefix, descriptionPrefix, scopePrefix, source, target) {
      for (const key of Object.keys(source)) {
        if (key.startsWith(prefix)) {
          const cmd = key.substring(prefix.length);
          target[`/${cmd}`] = {
            value: source[key],
            description: source[`${descriptionPrefix}${cmd}`],
            scope: source[`${scopePrefix}${cmd}`]?.split(",").map((s) => s.trim())
          };
        }
      }
    }
    migrateOldEnv(source) {
      if (source.TELEGRAM_TOKEN && !this.TELEGRAM_AVAILABLE_TOKENS.includes(source.TELEGRAM_TOKEN)) {
        if (source.BOT_NAME && this.TELEGRAM_AVAILABLE_TOKENS.length === this.TELEGRAM_BOT_NAME.length) {
          this.TELEGRAM_BOT_NAME.push(source.BOT_NAME);
        }
        this.TELEGRAM_AVAILABLE_TOKENS.push(source.TELEGRAM_TOKEN);
      }
      if (source.OPENAI_API_DOMAIN && !this.USER_CONFIG.OPENAI_API_BASE) {
        this.USER_CONFIG.OPENAI_API_BASE = `${source.OPENAI_API_DOMAIN}/v1`;
      }
      if (source.WORKERS_AI_MODEL && !this.USER_CONFIG.WORKERS_CHAT_MODEL) {
        this.USER_CONFIG.WORKERS_CHAT_MODEL = source.WORKERS_AI_MODEL;
      }
      if (source.API_KEY && this.USER_CONFIG.OPENAI_API_KEY.length === 0) {
        this.USER_CONFIG.OPENAI_API_KEY = source.API_KEY.split(",");
      }
      if (source.CHAT_MODEL && !this.USER_CONFIG.OPENAI_CHAT_MODEL) {
        this.USER_CONFIG.OPENAI_CHAT_MODEL = source.CHAT_MODEL;
      }
    }
    fixAgentUserConfigApiBase() {
      const keys = [
        "OPENAI_API_BASE"
      ];
      for (const key of keys) {
        const base = this.USER_CONFIG[key];
        if (this.USER_CONFIG[key] && typeof base === "string") {
          this.USER_CONFIG[key] = fixApiBase(base);
        }
      }
      this.TELEGRAM_API_DOMAIN = fixApiBase(this.TELEGRAM_API_DOMAIN);
    }
  }
export const ENV = new Environment();

export class ShareContext {
    botId;
    botToken;
    botName = null;
    chatHistoryKey;
    lastMessageKey;
    configStoreKey;
    groupAdminsKey;
    constructor(token, update) {
      const botId = Number.parseInt(token.split(":")[0]);
      const telegramIndex = ENV.TELEGRAM_AVAILABLE_TOKENS.indexOf(token);
      if (telegramIndex === -1) {
        throw new Error("Token not allowed");
      }
      if (ENV.TELEGRAM_BOT_NAME.length > telegramIndex) {
        this.botName = ENV.TELEGRAM_BOT_NAME[telegramIndex];
      }
      this.botToken = token;
      this.botId = botId;
      const id = update.chatID;
      if (id === undefined || id === null) {
        throw new Error("Chat id not found");
      }
      let historyKey = `history:${id}`;
      let configStoreKey = `user_config:${id}`;
      if (botId) {
        historyKey += `:${botId}`;
        configStoreKey += `:${botId}`;
      }
      switch (update.chatType) {
        case "group":
        case "supergroup":
          if (!ENV.GROUP_CHAT_BOT_SHARE_MODE && update.fromUserID) {
            historyKey += `:${update.fromUserID}`;
            configStoreKey += `:${update.fromUserID}`;
          }
          this.groupAdminsKey = `group_admin:${id}`;
          break;
      }
      if (update.isForum && update.isTopicMessage) {
        if (update.messageThreadID) {
          historyKey += `:${update.messageThreadID}`;
          configStoreKey += `:${update.messageThreadID}`;
        }
      }
      this.chatHistoryKey = historyKey;
      this.lastMessageKey = `last_message_id:${historyKey}`;
      this.configStoreKey = configStoreKey;
    }
  }
export class WorkerContext {
    USER_CONFIG;
    SHARE_CONTEXT;
    constructor(USER_CONFIG, SHARE_CONTEXT) {
      this.USER_CONFIG = USER_CONFIG;
      this.SHARE_CONTEXT = SHARE_CONTEXT;
      this.execChangeAndSave = this.execChangeAndSave.bind(this);
    }
    static async from(token, update) {
      const context = new UpdateContext(update);
      const SHARE_CONTEXT = new ShareContext(token, context);
      const USER_CONFIG = Object.assign({}, ENV.USER_CONFIG);
      try {
        const userConfig = JSON.parse(await ENV.DATABASE.get(SHARE_CONTEXT.configStoreKey));
        ConfigMerger.merge(USER_CONFIG, ConfigMerger.trim(userConfig, ENV.LOCK_USER_CONFIG_KEYS) || {});
      } catch (e) {
        console.warn(e);
      }
      return new WorkerContext(USER_CONFIG, SHARE_CONTEXT);
    }
    async execChangeAndSave(values) {
      for (const ent of Object.entries(values || {})) {
        let [key, value] = ent;
        key = ENV_KEY_MAPPER[key] || key;
        if (ENV.LOCK_USER_CONFIG_KEYS.includes(key)) {
          throw new Error(`Key ${key} is locked`);
        }
        const configKeys = Object.keys(this.USER_CONFIG || {}) || [];
        if (!configKeys.includes(key)) {
          throw new Error(`Key ${key} is not allowed`);
        }
        this.USER_CONFIG.DEFINE_KEYS.push(key);
        ConfigMerger.merge(this.USER_CONFIG, {
          [key]: value
        });
        console.log("Update user config: ", key, this.USER_CONFIG[key]);
      }
      this.USER_CONFIG.DEFINE_KEYS = Array.from(new Set(this.USER_CONFIG.DEFINE_KEYS));
      await ENV.DATABASE.put(
        this.SHARE_CONTEXT.configStoreKey,
        JSON.stringify(ConfigMerger.trim(this.USER_CONFIG, ENV.LOCK_USER_CONFIG_KEYS))
      );
    }
  }
export class UpdateContext {
    fromUserID;
    chatID;
    chatType;
    isForum;
    isTopicMessage;
    messageThreadID;
    constructor(update) {
      if (update.message) {
        this.fromUserID = update.message.from?.id;
        this.chatID = update.message.chat.id;
        this.chatType = update.message.chat.type;
        this.isForum = update.message.chat.is_forum;
        this.isTopicMessage = update.message.is_topic_message;
        this.messageThreadID = update.message.message_thread_id;
      } else if (update.callback_query) {
        this.fromUserID = update.callback_query.from.id;
        this.chatID = update.callback_query.message?.chat.id;
        this.chatType = update.callback_query.message?.chat.type;
        this.isForum = update.callback_query.message?.chat.is_forum;
      } else {
        console.error("Unknown update type");
      }
    }
  }
export class Cache {
    maxItems;
    maxAge;
    cache;
    constructor() {
      this.maxItems = 10;
      this.maxAge = 1e3 * 60 * 60;
      this.cache = {};
      this.set = this.set.bind(this);
      this.get = this.get.bind(this);
    }
    set(key, value) {
      this.trim();
      this.cache[key] = {
        value,
        time: Date.now()
      };
    }
    get(key) {
      this.trim();
      return this.cache[key]?.value;
    }
    trim() {
      let keys = Object.keys(this.cache);
      for (const key of keys) {
        if (Date.now() - this.cache[key].time > this.maxAge) {
          delete this.cache[key];
        }
      }
      keys = Object.keys(this.cache);
      if (keys.length > this.maxItems) {
        keys.sort((a, b) => this.cache[a].time - this.cache[b].time);
        for (let i = 0; i < keys.length - this.maxItems; i++) {
          delete this.cache[keys[i]];
        }
      }
    }
  }
export const IMAGE_CACHE = new Cache();

export async function fetchImage(url) {
    const cache = IMAGE_CACHE.get(url);
    if (cache) {
      return cache;
    }
    return fetch(url).then((resp) => resp.blob()).then((blob) => {
      IMAGE_CACHE.set(url, blob);
      return blob;
    });
  }
export async function urlToBase64String(url) {
    if (typeof Buffer !== "undefined") {
      return fetchImage(url).then((blob) => blob.arrayBuffer()).then((buffer) => Buffer.from(buffer).toString("base64"));
    } else {
      return fetchImage(url).then((blob) => blob.arrayBuffer()).then((buffer) => btoa(String.fromCharCode.apply(null, new Uint8Array(buffer))));
    }
  }
export function getImageFormatFromBase64(base64String) {
    const firstChar = base64String.charAt(0);
    switch (firstChar) {
      case "/":
        return "jpeg";
      case "i":
        return "png";
      case "U":
        return "webp";
      default:
        throw new Error("Unsupported image format");
    }
  }
export function renderBase64DataURI(params) {
  return `data:${params.format};base64,${params.data}`;
}

export async function imageToBase64String(url) {
    const base64String = await urlToBase64String(url);
    const format = getImageFormatFromBase64(base64String);
    return {
      data: base64String,
      format: `image/${format}`
    };
  }
export const INTERPOLATE_LOOP_REGEXP = /\{\{#each(?::(\w+))?\s+(\w+)\s+in\s+([\w.[\]]+)\}\}([\s\S]*?)\{\{\/each(?::\1)?\}\}/g;
export const INTERPOLATE_CONDITION_REGEXP = /\{\{#if(?::(\w+))?\s+([\w.[\]]+)\}\}([\s\S]*?)(?:\{\{#else(?::\1)?\}\}([\s\S]*?))?\{\{\/if(?::\1)?\}\}/g;
export const INTERPOLATE_VARIABLE_REGEXP = /\{\{([\w.[\]]+)\}\}/g;

export function evaluateExpression(expr, localData) {
  if (expr === ".") {
    return localData["."] ?? localData;
  }
  try {
    return expr.split(".").reduce((value, key) => {
      if (key.includes("[") && key.includes("]")) {
        const [arrayKey, indexStr] = key.split("[");
        const indexExpr = indexStr.slice(0, -1);
        let index = Number.parseInt(indexExpr, 10);
        if (Number.isNaN(index)) {
          index = evaluateExpression(indexExpr, localData);
        }
        return value?.[arrayKey]?.[index];
      }
      return value?.[key];
    }, localData);
  } catch (error) {
    console.error(`Error evaluating expression: ${expr}`, error);
    return undefined;
  }
}
export function interpolate(template, data, formatter) {
  const processConditional = (condition, trueBlock, falseBlock, localData) => {
    const result = evaluateExpression(condition, localData);
    return result ? trueBlock : falseBlock || "";
  };
  const processLoop = (itemName, arrayExpr, loopContent, localData) => {
    const array = evaluateExpression(arrayExpr, localData);
    if (!Array.isArray(array)) {
      console.warn(`Expression "${arrayExpr}" did not evaluate to an array`);
      return "";
    }
    return array.map((item) => {
      const itemData = { ...localData, [itemName]: item, ".": item };
      return interpolate(loopContent, itemData);
    }).join("");
  };
  const processTemplate = (tmpl, localData) => {
    tmpl = tmpl.replace(INTERPOLATE_LOOP_REGEXP, (_, alias, itemName, arrayExpr, loopContent) => processLoop(itemName, arrayExpr, loopContent, localData));
    tmpl = tmpl.replace(INTERPOLATE_CONDITION_REGEXP, (_, alias, condition, trueBlock, falseBlock) => processConditional(condition, trueBlock, falseBlock, localData));
    return tmpl.replace(INTERPOLATE_VARIABLE_REGEXP, (_, expr) => {
      const value = evaluateExpression(expr, localData);
      if (value === undefined) {
        return `{{${expr}}}`;
      }
      if (formatter) {
        return formatter(value);
      }
      return String(value);
    });
  };
  return processTemplate(template, data);
}
export function interpolateObject(obj, data) {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (typeof obj === "string") {
    return interpolate(obj, data);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, data));
  }
  if (typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, data);
    }
    return result;
  }
  return obj;
}