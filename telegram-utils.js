// telegram-utils.js - Вспомогательные функции для работы с Telegram

import {
  ENV
} from './config.js';

import {
  createTelegramBotAPI,
  MessageSender,
  loadChatRoleWithContext,
  executeRequest
} from './api.js';

export function formatInput(input, type) {
  if (type === "json") {
    return JSON.parse(input);
  } else if (type === "space-separated") {
    return input.trim().split(" ").filter(Boolean);
  } else if (type === "comma-separated") {
    return input.split(",").map((item) => item.trim()).filter(Boolean);
  } else {
    return input;
  }
}

export async function handleSystemCommand(message, raw, command, context) {
  const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
  try {
    const chatId = message.chat.id;
    const speakerId = message.from?.id || chatId;
    const chatType = message.chat.type;
    if (command.needAuth) {
      const roleList = command.needAuth(chatType);
      if (roleList) {
        const chatRole = await loadChatRoleWithContext(chatId, speakerId, context);
        if (chatRole === null) {
          return sender.sendPlainText("ERROR: Get chat role failed");
        }
        if (!roleList.includes(chatRole)) {
          return sender.sendPlainText(`ERROR: Permission denied, need ${roleList.join(" or ")}`);
        }
      }
    }
  } catch (e) {
    return sender.sendPlainText(`ERROR: ${e.message}`);
  }
  const subcommand = raw.substring(command.command.length).trim();
  try {
    return await command.handle(message, subcommand, context);
  } catch (e) {
    return sender.sendPlainText(`ERROR: ${e.message}`);
  }
}

export async function handlePluginCommand(message, command, raw, template, context) {
  const sender = MessageSender.fromMessage(context.SHARE_CONTEXT.botToken, message);
  try {
    const subcommand = raw.substring(command.length).trim();
    if (template.input?.required && !subcommand) {
      throw new Error("Missing required input");
    }
    const DATA = formatInput(subcommand, template.input?.type);
    const { type, content } = await executeRequest(template, {
      DATA,
      ENV: ENV.PLUGINS_ENV
    });
    switch (type) {
      case "image":
        return sender.sendPhoto(content);
      case "html":
        return sender.sendRichText(content, "HTML");
      case "markdown":
        return sender.sendRichText(content, "Markdown");
      case "text":
      default:
        return sender.sendPlainText(content);
    }
  } catch (e) {
    const help = ENV.PLUGINS_COMMAND[command].description;
    return sender.sendPlainText(`ERROR: ${e.message}${help ? `
${help}` : ""}`);
  }
}

export async function handleCommandMessage(message, context) {
  let text = (message.text || message.caption || "").trim();
  if (ENV.CUSTOM_COMMAND[text]) {
    text = ENV.CUSTOM_COMMAND[text].value;
  }
  
  // Динамический импорт команд для избежания циклических зависимостей
  const { SYSTEM_COMMANDS } = await import('./telegram-handlers.js');
  
  if (ENV.DEV_MODE) {
    const { EchoCommandHandler } = await import('./telegram-commands.js');
    SYSTEM_COMMANDS.push(new EchoCommandHandler());
  }
  
  for (const key in ENV.PLUGINS_COMMAND) {
    if (text === key || text.startsWith(`${key} `)) {
      let template = ENV.PLUGINS_COMMAND[key].value.trim();
      if (template.startsWith("http")) {
        template = await fetch(template).then((r) => r.text());
      }
      return await handlePluginCommand(message, key, text, JSON.parse(template), context);
    }
  }
  
  for (const cmd of SYSTEM_COMMANDS) {
    if (text === cmd.command || text.startsWith(`${cmd.command} `)) {
      return await handleSystemCommand(message, text, cmd, context);
    }
  }
  
  return null;
}

export async function commandsBindScope() {
  const scopeCommandMap = {
    all_private_chats: [],
    all_group_chats: [],
    all_chat_administrators: []
  };
  
  // Динамический импорт команд
  const { SYSTEM_COMMANDS } = await import('./telegram-handlers.js');
  
  // Если определены команды для меню бота, используем их
  if (ENV.BOT_MENU_COMMANDS && Array.isArray(ENV.BOT_MENU_COMMANDS) && ENV.BOT_MENU_COMMANDS.length > 0) {
    for (const cmdName of ENV.BOT_MENU_COMMANDS) {
      const cmd = SYSTEM_COMMANDS.find(c => c.command === cmdName);
      if (cmd) {
        const desc = ENV.I18N.command.help[cmd.command.substring(1)] || "";
        if (desc) {
          // Добавляем команду во все скоупы
          scopeCommandMap.all_private_chats.push({
            command: cmd.command,
            description: desc
          });
          scopeCommandMap.all_group_chats.push({
            command: cmd.command,
            description: desc
          });
          scopeCommandMap.all_chat_administrators.push({
            command: cmd.command,
            description: desc
          });
        }
      }
    }
  } else {
    // Стандартное поведение, если BOT_MENU_COMMANDS не определен
    for (const cmd of SYSTEM_COMMANDS) {
      if (ENV.HIDE_COMMAND_BUTTONS.includes(cmd.command)) {
        continue;
      }
      if (cmd.scopes) {
        for (const scope of cmd.scopes) {
          if (!scopeCommandMap[scope]) {
            scopeCommandMap[scope] = [];
          }
          const desc = ENV.I18N.command.help[cmd.command.substring(1)] || "";
          if (desc) {
            scopeCommandMap[scope].push({
              command: cmd.command,
              description: desc
            });
          }
        }
      }
    }
  }
  
  for (const list of [ENV.CUSTOM_COMMAND, ENV.PLUGINS_COMMAND]) {
    for (const [cmd, config] of Object.entries(list)) {
      if (config.scope) {
        for (const scope of config.scope) {
          if (!scopeCommandMap[scope]) {
            scopeCommandMap[scope] = [];
          }
          scopeCommandMap[scope].push({
            command: cmd,
            description: config.description || ""
          });
        }
      }
    }
  }
  
  const result = {};
  for (const scope in scopeCommandMap) {
    result[scope] = {
      commands: scopeCommandMap[scope],
      scope: {
        type: scope
      }
    };
  }
  
  return result;
}

export async function commandsDocument() {
  // Динамический импорт команд
  const { SYSTEM_COMMANDS } = await import('./telegram-handlers.js');
  
  return SYSTEM_COMMANDS.map((command) => {
    return {
      command: command.command,
      description: ENV.I18N.command.help[command.command.substring(1)] || ""
    };
  }).filter((item) => item.description !== "");
}