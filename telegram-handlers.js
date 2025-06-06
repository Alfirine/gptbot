// telegram-handlers.js - Основной файл для работы с Telegram

// Импорт из telegram-commands.js
import {
  HelpCommandHandler,
  BaseNewCommandHandler,
  NewCommandHandler,
  StartCommandHandler,
  RedoCommandHandler,
  EchoCommandHandler,
  UpdateMenuCommandHandler,
  errorToString
} from './telegram-commands.js';

// Импорт из telegram-system-commands.js
import {
  SetEnvCommandHandler,
  SetEnvsCommandHandler,
  DelEnvCommandHandler,
  ClearEnvCommandHandler,
  VersionCommandHandler,
  SystemCommandHandler
} from './telegram-system-commands.js';

// Импорт из telegram-model-commands.js
import {
  ModelsCommandHandler,
  ModelParamsCommandHandler
} from './telegram-model-commands.js';

// Импорт из telegram-utils.js
import {
  formatInput,
  handleSystemCommand,
  handlePluginCommand,
  handleCommandMessage,
  commandsBindScope,
  commandsDocument
} from './telegram-utils.js';

// Экспорт всех компонентов
export {
  // Из telegram-commands.js
  HelpCommandHandler,
  BaseNewCommandHandler,
  NewCommandHandler,
  StartCommandHandler,
  RedoCommandHandler,
  EchoCommandHandler,
  UpdateMenuCommandHandler,
  errorToString,
  
  // Из telegram-system-commands.js
  SetEnvCommandHandler,
  SetEnvsCommandHandler,
  DelEnvCommandHandler,
  ClearEnvCommandHandler,
  VersionCommandHandler,
  SystemCommandHandler,
  
  // Из telegram-model-commands.js
  ModelsCommandHandler,
  ModelParamsCommandHandler,
  
  // Из telegram-utils.js
  formatInput,
  handleSystemCommand,
  handlePluginCommand,
  handleCommandMessage,
  commandsBindScope,
  commandsDocument
};

// Список всех системных команд
export const SYSTEM_COMMANDS = [
  new StartCommandHandler(),
  new NewCommandHandler(),
  new RedoCommandHandler(),
  new SetEnvCommandHandler(),
  new SetEnvsCommandHandler(),
  new DelEnvCommandHandler(),
  new ClearEnvCommandHandler(),
  new VersionCommandHandler(),
  new SystemCommandHandler(),
  new ModelsCommandHandler(),
  new ModelParamsCommandHandler(),
  new UpdateMenuCommandHandler(),
  new HelpCommandHandler()
];