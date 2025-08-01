// api-openai.js - Функции для работы с OpenAI API

import {
  ENV,
  renderBase64DataURI,
  imageToBase64String
} from './config.js';

import {
  loadModelsList
} from './api-utils.js';

export var ImageSupportFormat = ((ImageSupportFormat2) => {
  ImageSupportFormat2["URL"] = "url";
  ImageSupportFormat2["BASE64"] = "base64";
  return ImageSupportFormat2;
})(ImageSupportFormat || {});

export function extractImageContent(imageData) {
  if (imageData instanceof URL) {
    return { url: imageData.href };
  }
  if (typeof imageData === "string") {
    if (imageData.startsWith("http")) {
      return { url: imageData };
    } else {
      return { base64: imageData };
    }
  }
  if (typeof Buffer !== "undefined") {
    if (imageData instanceof Uint8Array) {
      return { base64: Buffer.from(imageData).toString("base64") };
    }
    if (Buffer.isBuffer(imageData)) {
      return { base64: Buffer.from(imageData).toString("base64") };
    }
  }
  return {};
}

export async function renderOpenAIMessage(item, supportImage) {
  const res = {
    role: item.role,
    content: item.content
  };
  if (Array.isArray(item.content)) {
    const contents = [];
    for (const content of item.content) {
      switch (content.type) {
        case "text":
          contents.push({ type: "text", text: content.text });
          break;
        case "image":
          if (supportImage) {
            const isSupportURL = supportImage.includes("url" );
            const isSupportBase64 = supportImage.includes("base64" );
            const data = extractImageContent(content.image);
            if (data.url) {
              if (ENV.TELEGRAM_IMAGE_TRANSFER_MODE === "base64" && isSupportBase64) {
                contents.push(await imageToBase64String(data.url).then((data2) => {
                  return { type: "image_url", image_url: { url: renderBase64DataURI(data2) } };
                }));
              } else if (isSupportURL) {
                contents.push({ type: "image_url", image_url: { url: data.url } });
              }
            } else if (data.base64 && isSupportBase64) {
              contents.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${data.base64}` } });
            }
          }
          break;
      }
    }
    res.content = contents;
  }
  return res;
}

export async function renderOpenAIMessages(prompt, items, supportImage) {
  const messages = await Promise.all(items.map((r) => renderOpenAIMessage(r, supportImage)));
  if (prompt) {
    if (messages.length > 0 && messages[0].role === "system") {
      messages.shift();
    }
    messages.unshift({ role: "system", content: prompt });
  }
  return messages;
}

export function loadOpenAIModelList(list, base, headers) {
  if (list === "") {
    list = `${base}/models`;
  }
  return loadModelsList(list, async (url) => {
    const data = await fetch(url, { headers }).then((res) => res.json());
    return data.data?.map((model) => model.id) || [];
  });
}

export function agentConfigFieldGetter(fields) {
  return (ctx) => ({
    base: ctx[fields.base],
    key: ctx[fields.key] || null,
    model: ctx[fields.model],
    modelsList: ctx[fields.modelsList]
  });
}

export function createOpenAIRequest(builder, options) {
  return async (params, context, onStream) => {
    const { url, header, body } = await builder(params, context, onStream !== null);
    // Используем динамический импорт для избежания циклических зависимостей
    const { requestChatCompletions } = await import('./api-stream.js');
    return convertStringToResponseMessages(requestChatCompletions(url, header, body, onStream, null));
  };
}

export function createAgentEnable(valueGetter) {
  return (ctx) => !!valueGetter(ctx).key;
}

export function createAgentModel(valueGetter) {
  return (ctx) => valueGetter(ctx).model;
}

export function createAgentModelList(valueGetter) {
  return (ctx) => {
    const { base, key, modelsList } = valueGetter(ctx);
    return loadOpenAIModelList(modelsList, base, bearerHeader(key));
  };
}

export function defaultOpenAIRequestBuilder(valueGetter, completionsEndpoint = "/chat/completions", supportImage = ["url" ]) {
  return async (params, context, stream) => {
    const { prompt, messages } = params;
    const { base, key, model } = valueGetter(context);
    const url = `${base}${completionsEndpoint}`;
    const header = bearerHeader(key, stream);
    const body = {
      model,
      stream,
      messages: await renderOpenAIMessages(prompt, messages, supportImage)
    };
    return { url, header, body };
  };
}

export function bearerHeader(token, stream) {
  const res = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  if (stream !== undefined) {
    res.Accept = stream ? "text/event-stream" : "application/json";
  }
  return res;
}

export function getAgentUserConfigFieldName(fieldName) {
  return fieldName;
}

export function openAIApiKey(context) {
  const length = context.OPENAI_API_KEY.length;
  return context.OPENAI_API_KEY[Math.floor(Math.random() * length)];
}

export class OpenAICompatibilityAgent {
  name;
  modelKey;
  enable;
  model;
  modelList;
  request;
  constructor(name, fields) {
    this.name = name;
    this.modelKey = getAgentUserConfigFieldName(fields.model);
    const valueGetter = agentConfigFieldGetter(fields);
    this.enable = createAgentEnable(valueGetter);
    this.model = createAgentModel(valueGetter);
    this.modelList = createAgentModelList(valueGetter);
    this.request = createOpenAIRequest(defaultOpenAIRequestBuilder(valueGetter));
  }
}

export async function convertStringToResponseMessages(input) {
  const text = await input;
  return {
    text,
    responses: [{ role: "assistant", content: text }]
  };
}
