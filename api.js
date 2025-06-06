// api.js - Основной файл для экспорта API компонентов

// Импорт из api-client.js
import {
  APIClientBase,
  createTelegramBotAPI
} from './api-client.js';

// Импорт из api-telegram.js
import {
  isGroupChat,
  TELEGRAM_AUTH_CHECKER,
  checkMention,
  GroupMention,
  loadChatRoleWithContext,
  MessageContext,
  MessageSender,
  extractImageFileID,
  extractImageURL
} from './api-telegram.js';

// Импорт из api-stream.js
import {
  Stream,
  SSEDecoder,
  LineDecoder,
  defaultSSEJsonParser,
  fixOpenAICompatibleOptions,
  isJsonResponse,
  isEventStreamResponse,
  streamHandler,
  mapResponseToAnswer,
  requestChatCompletions
} from './api-stream.js';

// Импорт из api-openai.js
import {
  ImageSupportFormat,
  extractImageContent,
  renderOpenAIMessage,
  renderOpenAIMessages,
  loadOpenAIModelList,
  agentConfigFieldGetter,
  createOpenAIRequest,
  createAgentEnable,
  createAgentModel,
  createAgentModelList,
  defaultOpenAIRequestBuilder,
  bearerHeader,
  getAgentUserConfigFieldName,
  openAIApiKey,
  OpenAICompatibilityAgent,
  convertStringToResponseMessages
} from './api-openai.js';

// Импорт из api-utils.js
import {
  extractTextContent,
  loadModelsList,
  loadHistory,
  requestCompletionsFromLLM,
  executeRequest,
  tokensCounter
} from './api-utils.js';

// Экспорт всех компонентов
export {
  // Из api-client.js
  APIClientBase,
  createTelegramBotAPI,
  
  // Из api-telegram.js
  isGroupChat,
  TELEGRAM_AUTH_CHECKER,
  checkMention,
  GroupMention,
  loadChatRoleWithContext,
  MessageContext,
  MessageSender,
  extractImageFileID,
  extractImageURL,
  
  // Из api-stream.js
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
  
  // Из api-openai.js
  ImageSupportFormat,
  extractImageContent,
  renderOpenAIMessage,
  renderOpenAIMessages,
  loadOpenAIModelList,
  agentConfigFieldGetter,
  createOpenAIRequest,
  createAgentEnable,
  createAgentModel,
  createAgentModelList,
  defaultOpenAIRequestBuilder,
  bearerHeader,
  getAgentUserConfigFieldName,
  openAIApiKey,
  OpenAICompatibilityAgent,
  convertStringToResponseMessages,
  
  // Из api-utils.js
  extractTextContent,
  loadModelsList,
  loadHistory,
  requestCompletionsFromLLM,
  executeRequest,
  tokensCounter
};