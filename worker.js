// worker.js - Точка входа в приложение

import {
  ENV,
  AgentShareConfig,
  OpenAIConfig,
  DefineKeys,
  EnvironmentConfig,
  ConfigMerger,
  ShareContext,
  WorkerContext,
  UpdateContext,
  Cache,
  IMAGE_CACHE,
  fetchImage,
  urlToBase64String,
  getImageFormatFromBase64,
  imageToBase64String,
  renderBase64DataURI,
  interpolate,
  interpolateObject
} from './config.js';

import {
  APIClientBase,
  createTelegramBotAPI,
  MessageContext,
  MessageSender,
  Stream,
  SSEDecoder,
  LineDecoder,
  defaultSSEJsonParser,
  fixOpenAICompatibleOptions,
  isJsonResponse,
  isEventStreamResponse,
  streamHandler,
  mapResponseToAnswer,
  requestChatCompletions,
  extractTextContent,
  extractImageContent,
  convertStringToResponseMessages,
  loadModelsList,
  bearerHeader,
  getAgentUserConfigFieldName,
  tokensCounter,
  loadHistory,
  requestCompletionsFromLLM,
  executeRequest,
  isGroupChat,
  TELEGRAM_AUTH_CHECKER,
  GroupMention,
  loadChatRoleWithContext
} from './api.js';

import { 
  OpenAI, 
  WorkersChat, 
  CHAT_AGENTS, 
  loadChatLLM, 
  IMAGE_AGENTS, 
  loadImageGen,
  searchOnline,
  onlineSearchModifier
} from './ai-providers.js';

import {
  AgentListCallbackQueryHandler,
  ModelListCallbackQueryHandler,
  ModelChangeCallbackQueryHandler,
  SetModelCallbackQueryHandler,
  ProviderModelsCallbackQueryHandler,
  BackToProvidersCallbackQueryHandler,
  NoopCallbackQueryHandler,
  ModelParamChangeCallbackQueryHandler,
  SetModelParamCallbackQueryHandler,
  BackToModelParamsCallbackQueryHandler,
  QUERY_HANDLERS,
  handleCallbackQuery
} from './callback-handlers.js';

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

import {
  SetEnvCommandHandler,
  SetEnvsCommandHandler,
  DelEnvCommandHandler,
  ClearEnvCommandHandler,
  VersionCommandHandler,
  SystemCommandHandler,
  SetSystemPromptCommandHandler,
  GetSystemPromptCommandHandler,
  ClearSystemPromptCommandHandler
} from './telegram-system-commands.js';

import {
  ModelsCommandHandler,
  ModelParamsCommandHandler
} from './telegram-model-commands.js';

import {
  formatInput,
  handleSystemCommand,
  handlePluginCommand,
  handleCommandMessage,
  commandsBindScope,
  commandsDocument
} from './telegram-utils.js';

import {
  SYSTEM_COMMANDS
} from './telegram-handlers.js';

import {
  chatWithMessage,
  extractUserMessageItem,
  EnvChecker,
  WhiteListFilter,
  Update2MessageHandler,
  SaveLastMessage,
  OldMessageFilter,
  MessageFilter,
  CommandHandler,
  ChatHandler,
  CallbackQueryHandler,
  SHARE_HANDLER,
  handleUpdate
} from './message-handlers.js';

import {
  renderHTML,
  makeResponse200,
  Router,
  bindWebHookAction,
  telegramWebhook,
  telegramSafeHook,
  defaultIndexAction,
  createRouter,
  Workers
} from './router.js';

// Экспорт основного объекта Workers
export default Workers;