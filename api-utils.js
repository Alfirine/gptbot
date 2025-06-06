// api-utils.js - Вспомогательные функции

import {
  ENV
} from './config.js';

export function extractTextContent(history) {
  if (typeof history.content === "string") {
    return history.content;
  }
  if (Array.isArray(history.content)) {
    return history.content.map((item) => {
      if (item.type === "text") {
        return item.text;
      }
      return "";
    }).join("");
  }
  return "";
}

export async function loadModelsList(raw, remoteLoader) {
  if (!raw) {
    return [];
  }
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error(e);
      return [];
    }
  }
  if (raw.startsWith("http") && remoteLoader) {
    return await remoteLoader(raw);
  }
  return [raw];
}

export async function loadHistory(context) {
  let history = [];
  try {
    history = JSON.parse(await ENV.DATABASE.get(context.SHARE_CONTEXT.chatHistoryKey));
  } catch (e) {
    console.error(e);
  }
  if (!history || !Array.isArray(history)) {
    history = [];
  }
  const counter = tokensCounter();
  const trimHistory = (list, initLength, maxLength, maxToken) => {
    if (maxLength >= 0 && list.length > maxLength) {
      list = list.splice(list.length - maxLength);
    }
    if (maxToken > 0) {
      let tokenLength = initLength;
      for (let i = list.length - 1; i >= 0; i--) {
        const historyItem = list[i];
        let length = 0;
        if (historyItem.content) {
          length = counter(extractTextContent(historyItem));
        } else {
          historyItem.content = "";
        }
        tokenLength += length;
        if (tokenLength > maxToken) {
          list = list.splice(i + 1);
          break;
        }
      }
    }
    return list;
  };
  if (ENV.AUTO_TRIM_HISTORY && ENV.MAX_HISTORY_LENGTH > 0) {
    history = trimHistory(history, 0, ENV.MAX_HISTORY_LENGTH, ENV.MAX_TOKEN_LENGTH);
  }
  return history;
}

export async function requestCompletionsFromLLM(params, context, agent, modifier, onStream) {
  const historyDisable = ENV.AUTO_TRIM_HISTORY && ENV.MAX_HISTORY_LENGTH <= 0;
  const historyKey = context.SHARE_CONTEXT.chatHistoryKey;
  if (!historyKey) {
    throw new Error("History key not found");
  }
  let history = await loadHistory(context);
  if (modifier) {
    const modifierData = modifier(history, params || null);
    history = modifierData.history;
    params = modifierData.message;
  }
  if (!params) {
    throw new Error("Message is empty");
  }
  const llmParams = {
    prompt: context.USER_CONFIG.SYSTEM_INIT_MESSAGE || undefined,
    messages: [...history, params]
  };
  // Используем динамический импорт для избежания циклических зависимостей
  const { text, responses } = await agent.request(llmParams, context.USER_CONFIG, onStream);
  if (!historyDisable) {
    const editParams = { ...params };
    if (ENV.HISTORY_IMAGE_PLACEHOLDER) {
      if (Array.isArray(editParams.content)) {
        const imageCount = editParams.content.filter((i) => i.type === "image").length;
        const textContent = editParams.content.findLast((i) => i.type === "text");
        if (textContent) {
          editParams.content = editParams.content.filter((i) => i.type !== "image");
          textContent.text = textContent.text + ` ${ENV.HISTORY_IMAGE_PLACEHOLDER}`.repeat(imageCount);
        }
      }
    }
    await ENV.DATABASE.put(historyKey, JSON.stringify([...history, editParams, ...responses])).catch(console.error);
  }
  return text;
}

export async function executeRequest(template, data) {
  const urlRaw = interpolate(template.url, data, encodeURIComponent);
  const url = new URL(urlRaw);
  if (template.query) {
    for (const [key, value] of Object.entries(template.query)) {
      url.searchParams.append(key, interpolate(value, data));
    }
  }
  const method = template.method;
  const headers = Object.fromEntries(
    Object.entries(template.headers || {}).map(([key, value]) => {
      return [key, interpolate(value, data)];
    })
  );
  for (const key of Object.keys(headers)) {
    if (headers[key] === null) {
      delete headers[key];
    }
  }
  let body = null;
  if (template.body) {
    if (template.body.type === "json") {
      body = JSON.stringify(interpolateObject(template.body.content, data));
    } else if (template.body.type === "form") {
      body = new URLSearchParams();
      for (const [key, value] of Object.entries(template.body.content)) {
        body.append(key, interpolate(value, data));
      }
    } else {
      body = interpolate(template.body.content, data);
    }
  }
  const response = await fetch(url, {
    method,
    headers,
    body
  });
  const renderOutput = async (type, temple, response2) => {
    switch (type) {
      case "text":
        return interpolate(temple, await response2.text());
      case "blob":
        throw new Error("Invalid output type");
      case "json":
      default:
        return interpolate(temple, await response2.json());
    }
  };
  if (!response.ok) {
    const content2 = await renderOutput(template.response?.error?.input_type, template.response.error?.output, response);
    return {
      type: template.response.error.output_type,
      content: content2
    };
  }
  if (template.response.content.input_type === "blob") {
    if (template.response.content.output_type !== "image") {
      throw new Error("Invalid output type");
    }
    return {
      type: "image",
      content: await response.blob()
    };
  }
  const content = await renderOutput(template.response.content?.input_type, template.response.content?.output, response);
  return {
    type: template.response.content.output_type,
    content
  };
}

export function tokensCounter() {
  return (text) => {
    return text.length;
  };
}

// Импортируем функции из config.js, которые используются в executeRequest
import { interpolate, interpolateObject } from './config.js';