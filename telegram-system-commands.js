// telegram-system-commands.js - Системные команды Telegram

import {
  ENV,
  ConfigMerger
} from './config.js';

import {
  createTelegramBotAPI,
  MessageSender,
  TELEGRAM_AUTH_CHECKER,
  loadChatRoleWithContext
} from './api.js';

import {
  loadChatLLM
} from './ai-providers.js';

export class SetEnvCommandHandler {
  command = "/setenv";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    const kv = subcommand.indexOf("=");
    if (kv === -1) {
      return sender.sendPlainText(ENV.I18N.command.help.setenv);
    }
    const key = subcommand.slice(0, kv);
    const value = subcommand.slice(kv + 1);
    try {
      await context.execChangeAndSave({ [key]: value });
      return sender.sendPlainText("Update user config success");
    } catch (e) {
      return sender.sendPlainText(`ERROR: ${e.message}`);
    }
  };
}

export class SetEnvsCommandHandler {
  command = "/setenvs";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    try {
      const values = JSON.parse(subcommand);
      await context.execChangeAndSave(values);
      return sender.sendPlainText("Update user config success");
    } catch (e) {
      return sender.sendPlainText(`ERROR: ${e.message}`);
    }
  };
}

export class DelEnvCommandHandler {
  command = "/delenv";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    if (ENV.LOCK_USER_CONFIG_KEYS.includes(subcommand)) {
      const msg = `Key ${subcommand} is locked`;
      return sender.sendPlainText(msg);
    }
    try {
      context.USER_CONFIG[subcommand] = null;
      context.USER_CONFIG.DEFINE_KEYS = context.USER_CONFIG.DEFINE_KEYS.filter((key) => key !== subcommand);
      await ENV.DATABASE.put(
        context.SHARE_CONTEXT.configStoreKey,
        JSON.stringify(ConfigMerger.trim(context.USER_CONFIG, ENV.LOCK_USER_CONFIG_KEYS))
      );
      return sender.sendPlainText("Delete user config success");
    } catch (e) {
      return sender.sendPlainText(`ERROR: ${e.message}`);
    }
  };
}

export class ClearEnvCommandHandler {
  command = "/clearenv";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    try {
      await ENV.DATABASE.put(
        context.SHARE_CONTEXT.configStoreKey,
        JSON.stringify({})
      );
      return sender.sendPlainText("Clear user config success");
    } catch (e) {
      return sender.sendPlainText(`ERROR: ${e.message}`);
    }
  };
}

export class VersionCommandHandler {
  command = "/version";
  scopes = ["all_private_chats", "all_chat_administrators"];
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    const current = {
      ts: ENV.BUILD_TIMESTAMP,
      sha: ENV.BUILD_VERSION
    };
    try {
      const info = `https://raw.githubusercontent.com/TBXark/ChatGPT-Telegram-Workers/${ENV.UPDATE_BRANCH}/dist/buildinfo.json`;
      const online = await fetch(info).then((r) => r.json());
      const timeFormat = (ts) => {
        return new Date(ts * 1e3).toLocaleString("en-US", {});
      };
      if (current.ts < online.ts) {
        const text = `New version detected: ${online.sha}(${timeFormat(online.ts)})
Current version: ${current.sha}(${timeFormat(current.ts)})`;
        return sender.sendPlainText(text);
      } else {
        const text = `Current version: ${current.sha}(${timeFormat(current.ts)}) is up to date`;
        return sender.sendPlainText(text);
      }
    } catch (e) {
      return sender.sendPlainText(`ERROR: ${e.message}`);
    }
  };
}

export class SystemCommandHandler {
  command = "/system";
  scopes = ["all_private_chats", "all_chat_administrators"];
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    const chatAgent = loadChatLLM(context.USER_CONFIG);
    const agent = {
      AI_PROVIDER: chatAgent?.name,
      [chatAgent?.modelKey || "AI_PROVIDER_NOT_FOUND"]: chatAgent?.model(context.USER_CONFIG)
    };
    let msg = `<strong>AGENT</strong><pre>${JSON.stringify(agent, null, 2)}</pre>`;
    if (ENV.DEV_MODE) {
      const config = ConfigMerger.trim(context.USER_CONFIG, ENV.LOCK_USER_CONFIG_KEYS);
      msg += `

<strong>USER_CONFIG</strong><pre>${JSON.stringify(config, null, 2)}</pre>`;
      const secretsSuffix = ["_API_KEY", "_TOKEN", "_ACCOUNT_ID"];
      for (const key of Object.keys(context.USER_CONFIG)) {
        if (secretsSuffix.some((suffix) => key.endsWith(suffix))) {
          context.USER_CONFIG[key] = "******";
        }
      }
      msg += `

<strong>CHAT_CONTEXT</strong><pre>${JSON.stringify(sender.context || {}, null, 2)}</pre>`;
      const shareCtx = { ...context.SHARE_CONTEXT, botToken: "******" };
      msg += `

<strong>SHARE_CONTEXT</strong><pre>${JSON.stringify(shareCtx, null, 2)}</pre>`;
    }
    return sender.sendRichText(msg, "HTML");
  };
}

export class SetSystemPromptCommandHandler {
  command = "/setsystemprompt";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    
    if (!subcommand || subcommand.trim() === "") {
      return sender.sendPlainText(ENV.I18N.command.help.setsystemprompt);
    }
    
    try {
      await context.execChangeAndSave({ SYSTEM_INIT_MESSAGE: subcommand.trim() });
      return sender.sendPlainText("Системный промпт успешно установлен");
    } catch (e) {
      return sender.sendPlainText(`ОШИБКА: ${e.message}`);
    }
  };
}

export class GetSystemPromptCommandHandler {
  command = "/getsystemprompt";
  scopes = ["all_private_chats", "all_chat_administrators"];
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    
    const currentPrompt = context.USER_CONFIG.SYSTEM_INIT_MESSAGE;
    
    if (!currentPrompt) {
      return sender.sendPlainText("Системный промпт не установлен. Используется промпт по умолчанию: \"" + ENV.I18N.env.system_init_message + "\"");
    }
    
    const msg = `<strong>Текущий системный промпт:</strong>\n<pre>${currentPrompt}</pre>`;
    return sender.sendRichText(msg, "HTML");
  };
}

export class ClearSystemPromptCommandHandler {
  command = "/clearsystemprompt";
  needAuth = TELEGRAM_AUTH_CHECKER.shareModeGroup;
  handle = async (message, subcommand, context) => {
    const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
    
    try {
      await context.execChangeAndSave({ SYSTEM_INIT_MESSAGE: null });
      return sender.sendPlainText("Системный промпт очищен. Теперь используется промпт по умолчанию.");
    } catch (e) {
      return sender.sendPlainText(`ОШИБКА: ${e.message}`);
    }
  };
}