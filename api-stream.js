// api-stream.js - Классы и функции для работы с потоками данных

import {
  ENV
} from './config.js';

export class Stream {
  response;
  controller;
  decoder;
  parser;
  constructor(response, controller, parser = null) {
    this.response = response;
    this.controller = controller;
    this.decoder = new SSEDecoder();
    this.parser = parser || defaultSSEJsonParser;
  }
  async *iterMessages() {
    if (!this.response.body) {
      this.controller.abort();
      throw new Error("Attempted to iterate over a response with no body");
    }
    const lineDecoder = new LineDecoder();
    const iter = this.response.body;
    for await (const chunk of iter) {
      for (const line of lineDecoder.decode(chunk)) {
        const sse = this.decoder.decode(line);
        if (sse) {
          yield sse;
        }
      }
    }
    for (const line of lineDecoder.flush()) {
      const sse = this.decoder.decode(line);
      if (sse) {
        yield sse;
      }
    }
  }
  async *[Symbol.asyncIterator]() {
    let done = false;
    try {
      for await (const sse of this.iterMessages()) {
        if (done) {
          continue;
        }
        if (!sse) {
          continue;
        }
        const { finish, data } = this.parser(sse);
        if (finish) {
          done = finish;
          continue;
        }
        if (data) {
          yield data;
        }
      }
      done = true;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return;
      }
      throw e;
    } finally {
      if (!done) {
        this.controller.abort();
      }
    }
  }
}

export class SSEDecoder {
  event;
  data;
  constructor() {
    this.event = null;
    this.data = [];
  }
  decode(line) {
    if (line.endsWith("\r")) {
      line = line.substring(0, line.length - 1);
    }
    if (!line) {
      if (!this.event && !this.data.length) {
        return null;
      }
      const sse = {
        event: this.event,
        data: this.data.join("\n")
      };
      this.event = null;
      this.data = [];
      return sse;
    }
    if (line.startsWith(":")) {
      return null;
    }
    let [fieldName, _, value] = this.partition(line, ":");
    if (value.startsWith(" ")) {
      value = value.substring(1);
    }
    if (fieldName === "event") {
      this.event = value;
    } else if (fieldName === "data") {
      this.data.push(value);
    }
    return null;
  }
  partition(str, delimiter) {
    const index = str.indexOf(delimiter);
    if (index !== -1) {
      return [str.substring(0, index), delimiter, str.substring(index + delimiter.length)];
    }
    return [str, "", ""];
  }
}

export function defaultSSEJsonParser(sse) {
  if (sse.data?.startsWith("[DONE]")) {
    return { finish: true };
  }
  if (sse.data) {
    try {
      return { data: JSON.parse(sse.data) };
    } catch (e) {
      console.error(e, sse);
    }
  }
  return {};
}

export class LineDecoder {
  buffer;
  trailingCR;
  textDecoder;
  static NEWLINE_CHARS =  new Set(["\n", "\r"]);
  static NEWLINE_REGEXP = /\r\n|[\n\r]/g;
  constructor() {
    this.buffer = [];
    this.trailingCR = false;
  }
  decode(chunk) {
    let text = this.decodeText(chunk);
    if (this.trailingCR) {
      text = `\r${text}`;
      this.trailingCR = false;
    }
    if (text.endsWith("\r")) {
      this.trailingCR = true;
      text = text.slice(0, -1);
    }
    if (!text) {
      return [];
    }
    const trailingNewline = LineDecoder.NEWLINE_CHARS.has(text[text.length - 1] || "");
    let lines = text.split(LineDecoder.NEWLINE_REGEXP);
    if (lines.length === 1 && !trailingNewline) {
      this.buffer.push(lines[0]);
      return [];
    }
    if (this.buffer.length > 0) {
      lines = [this.buffer.join("") + lines[0], ...lines.slice(1)];
      this.buffer = [];
    }
    if (!trailingNewline) {
      this.buffer = [lines.pop() || ""];
    }
    return lines;
  }
  decodeText(bytes) {
    if (bytes == null) {
      return "";
    }
    if (typeof bytes === "string") {
      return bytes;
    }
    if (typeof Buffer !== "undefined") {
      if (bytes instanceof Buffer) {
        return bytes.toString();
      }
      if (bytes instanceof Uint8Array) {
        return Buffer.from(bytes).toString();
      }
      throw new Error(`Unexpected: received non-Uint8Array (${bytes.constructor.name}) stream chunk in an environment with a global "Buffer" defined, which this library assumes to be Node. Please report this error.`);
    }
    if (typeof TextDecoder !== "undefined") {
      if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
        if (!this.textDecoder) {
          this.textDecoder = new TextDecoder("utf8");
        }
        return this.textDecoder.decode(bytes, { stream: true });
      }
      throw new Error(`Unexpected: received non-Uint8Array/ArrayBuffer in a web platform. Please report this error.`);
    }
    throw new Error("Unexpected: neither Buffer nor TextDecoder are available as globals. Please report this error.");
  }
  flush() {
    if (!this.buffer.length && !this.trailingCR) {
      return [];
    }
    const lines = [this.buffer.join("")];
    this.buffer = [];
    this.trailingCR = false;
    return lines;
  }
}

export function fixOpenAICompatibleOptions(options) {
  options = options || {};
  options.streamBuilder = options.streamBuilder || function(r, c) {
    return new Stream(r, c);
  };
  options.contentExtractor = options.contentExtractor || function(d) {
    return d?.choices?.at(0)?.delta?.content;
  };
  options.fullContentExtractor = options.fullContentExtractor || function(d) {
    return d.choices?.at(0)?.message.content;
  };
  options.errorExtractor = options.errorExtractor || function(d) {
    return d.error?.message;
  };
  return options;
}

export function isJsonResponse(resp) {
  const contentType = resp.headers.get("content-type");
  return contentType?.toLowerCase().includes("application/json") ?? false;
}

export function isEventStreamResponse(resp) {
  const types = ["application/stream+json", "text/event-stream"];
  const content = resp.headers.get("content-type")?.toLowerCase() || "";
  for (const type of types) {
    if (content.includes(type)) {
      return true;
    }
  }
  return false;
}

export async function streamHandler(stream, contentExtractor, onStream) {
  let contentFull = "";
  let lengthDelta = 0;
  let updateStep = 50;
  let lastUpdateTime = Date.now();
  try {
    for await (const part of stream) {
      const textPart = contentExtractor(part);
      if (!textPart) {
        continue;
      }
      lengthDelta += textPart.length;
      contentFull = contentFull + textPart;
      if (lengthDelta > updateStep) {
        if (ENV.TELEGRAM_MIN_STREAM_INTERVAL > 0) {
          const delta = Date.now() - lastUpdateTime;
          if (delta < ENV.TELEGRAM_MIN_STREAM_INTERVAL) {
            continue;
          }
          lastUpdateTime = Date.now();
        }
        lengthDelta = 0;
        updateStep += 20;
        await onStream?.(`${contentFull}
...`);
      }
    }
  } catch (e) {
    contentFull += `
Error: ${e.message}`;
  }
  return contentFull;
}

export async function mapResponseToAnswer(resp, controller, options, onStream) {
  options = fixOpenAICompatibleOptions(options || null);
  if (onStream && resp.ok && isEventStreamResponse(resp)) {
    const stream = options.streamBuilder?.(resp, controller || new AbortController());
    if (!stream) {
      throw new Error("Stream builder error");
    }
    return streamHandler(stream, options.contentExtractor, onStream);
  }
  if (!isJsonResponse(resp)) {
    throw new Error(resp.statusText);
  }
  const result = await resp.json();
  if (!result) {
    throw new Error("Empty response");
  }
  if (options.errorExtractor?.(result)) {
    throw new Error(options.errorExtractor?.(result) || "Unknown error");
  }
  return options.fullContentExtractor?.(result) || "";
}

export async function requestChatCompletions(url, header, body, onStream, options) {
  // Исправление: корректная обработка таймаута (секунды) и ошибок AbortError
  const controller = new AbortController();
  const { signal } = controller;
  let timeoutID = null;
  let timeoutMs = (typeof ENV.CHAT_COMPLETE_API_TIMEOUT === "number" && ENV.CHAT_COMPLETE_API_TIMEOUT > 0)
    ? ENV.CHAT_COMPLETE_API_TIMEOUT * 1000
    : 30000;
  timeoutID = setTimeout(() => controller.abort(), timeoutMs);

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: header,
      body: JSON.stringify(body),
      signal
    });
  } catch (e) {
    if (timeoutID) clearTimeout(timeoutID);
    if (e.name === "AbortError") {
      throw new Error("Запрос к модели был прерван (AbortError). Возможные причины: ошибка сети, неверный API-ключ, недоступность OpenRouter или слишком короткий таймаут.");
    }
    throw e;
  }
  if (timeoutID) clearTimeout(timeoutID);
  return await mapResponseToAnswer(resp, controller, options, onStream);
}