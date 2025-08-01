// ai-providers.js - Классы и функции для работы с AI-провайдерами

import {
  ENV,
  interpolate
} from './config.js';

import {
  bearerHeader,
  openAIApiKey,
  requestChatCompletions,
  convertStringToResponseMessages,
  mapResponseToAnswer,
  renderOpenAIMessages,
  getAgentUserConfigFieldName,
  loadOpenAIModelList,
  ImageSupportFormat,
  loadHistory,
  requestCompletionsFromLLM,
  executeRequest
} from './api.js';

export class OpenAI {
  name = "openai";
  modelKey = getAgentUserConfigFieldName("OPENAI_CHAT_MODEL");
  enable = (ctx) => ctx.OPENAI_API_KEY.length > 0;
  model = (ctx) => ctx.OPENAI_CHAT_MODEL;
  modelList = (ctx) => loadOpenAIModelList(ctx.OPENAI_CHAT_MODELS_LIST, ctx.OPENAI_API_BASE, bearerHeader(openAIApiKey(ctx)));
  
  // Метод для анализа изображений с использованием независимой модели
  analyzeImage = async (base64Image, context, mimeType = "image/jpeg") => {
        // Определяем URL API
        const url = `${context.OPENAI_API_BASE}/chat/completions`;
        const apiKey = openAIApiKey(context);
        
        // Создаем заголовки
        const headers = {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        };
      
        // Используем независимую модель для распознавания изображений
        const model = context.VISION_MODEL || "openai/gpt-4.1";
        
        const body = {
            model: model,
            max_tokens: 500,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Пожалуйста, опиши содержимое этого изображения. Если на изображении есть текст, прочитай его и приведи полностью."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ]
        };
        
        try {
            // Отправляем запрос
            const response = await fetch(url, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(body)
            });
            
            // Проверяем, успешен ли запрос
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
            }
            
            // Обрабатываем ответ
            const data = await response.json();
            return data.choices[0]?.message?.content || "Не удалось распознать содержимое изображения";
            
        } catch (error) {
            console.error("Error analyzing image:", error);
            throw new Error(`Ошибка при анализе изображения: ${error.message}`);
        }
    };
    
    request = async (params, context, onStream) => {
      const { prompt, messages } = params;
      const url = `${context.OPENAI_API_BASE}/chat/completions`;
      const header = bearerHeader(openAIApiKey(context));
      const body = {
        ...context.OPENAI_API_EXTRA_PARAMS,
        model: context.OPENAI_CHAT_MODEL,
        messages: await renderOpenAIMessages(prompt, messages, [ImageSupportFormat.URL, ImageSupportFormat.BASE64]),
        stream: onStream != null,
        // Добавляем параметры модели
        temperature: parseFloat(context.TEMPERATURE) || 0.7,
        max_tokens: parseInt(context.MAX_TOKENS) || 1000,
        top_k: parseInt(context.TOP_K) || 40,
        top_p: parseFloat(context.TOP_P) || 0.9
      };
      // Исправление: корректная обработка таймаута и ошибок AbortError
      let controller = new AbortController();
      let timeoutID = null;
      if (context.CHAT_COMPLETE_API_TIMEOUT > 0) {
        timeoutID = setTimeout(() => controller.abort(), context.CHAT_COMPLETE_API_TIMEOUT * 1000);
      }
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: header,
          body: JSON.stringify(body),
          signal: controller.signal
        });
        if (timeoutID) clearTimeout(timeoutID);
        return convertStringToResponseMessages(requestChatCompletions(url, header, body, onStream, null));
      } catch (e) {
        if (timeoutID) clearTimeout(timeoutID);
        if (e.name === "AbortError") {
          throw new Error("Время ожидания ответа от модели истекло (timeout). Попробуйте еще раз или выберите другую модель.");
        }
        throw e;
      }
    };
}

export function isWorkerAIEnable(context) {
  if (ENV.AI_BINDING) {
    return true;
  }
  return !!(context.CLOUDFLARE_ACCOUNT_ID && context.CLOUDFLARE_TOKEN);
}

export function loadWorkersModelList(task, loader) {
  return async (context) => {
    let uri = loader(context);
    if (uri === "") {
      const id = context.CLOUDFLARE_ACCOUNT_ID;
      const taskEncoded = encodeURIComponent(task);
      uri = `https://api.cloudflare.com/client/v4/accounts/${id}/ai/models/search?task=${taskEncoded}`;
    }
    return loadModelsList(uri, async (url) => {
      const header = {
        Authorization: `Bearer ${context.CLOUDFLARE_TOKEN}`
      };
      const data = await fetch(url, { headers: header }).then((res) => res.json());
      return data.result?.map((model) => model.name) || [];
    });
  };
}

export class WorkersChat {
  name = "workers";
  modelKey = getAgentUserConfigFieldName("WORKERS_CHAT_MODEL");
  enable = isWorkerAIEnable;
  model = (ctx) => ctx.WORKERS_CHAT_MODEL;
  modelList = loadWorkersModelList("Text Generation", (ctx) => ctx.WORKERS_CHAT_MODELS_LIST);
  request = async (params, context, onStream) => {
    const { prompt, messages } = params;
    const model = context.WORKERS_CHAT_MODEL;
    const body = {
      messages: await renderOpenAIMessages(prompt, messages, null),
      stream: onStream !== null
    };
    const options = {};
    options.contentExtractor = function(data) {
      return data?.response;
    };
    options.fullContentExtractor = function(data) {
      return data?.result?.response;
    };
    options.errorExtractor = function(data) {
      return data?.errors?.at(0)?.message;
    };
    if (ENV.AI_BINDING) {
      const answer = await ENV.AI_BINDING.run(model, body);
      const response = WorkersChat.outputToResponse(answer, onStream !== null);
      return convertStringToResponseMessages(mapResponseToAnswer(response, new AbortController(), options, onStream));
    } else if (context.CLOUDFLARE_ACCOUNT_ID && context.CLOUDFLARE_TOKEN) {
      const id = context.CLOUDFLARE_ACCOUNT_ID;
      const token = context.CLOUDFLARE_TOKEN;
      const url = `https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/${model}`;
      const header = bearerHeader(token, onStream !== null);
      return convertStringToResponseMessages(requestChatCompletions(url, header, body, onStream, options));
    } else {
      throw new Error("Cloudflare account ID and token are required");
    }
  };
  static outputToResponse(output, stream) {
    if (stream && output instanceof ReadableStream) {
      return new Response(output, {
        headers: { "content-type": "text/event-stream" }
      });
    } else {
      return Response.json({ result: output });
    }
  }
}

export const CHAT_AGENTS = [
  new OpenAI(),
  new WorkersChat()
];

export function loadChatLLM(context) {
  for (const llm of CHAT_AGENTS) {
    if (llm.name === context.AI_PROVIDER) {
      return llm;
    }
  }
  for (const llm of CHAT_AGENTS) {
    if (llm.enable(context)) {
      return llm;
    }
  }
  return null;
}

export const IMAGE_AGENTS = [];

export function loadImageGen(context) {
  return null;
}

// Функция для выполнения поиска в интернете
export async function searchOnline(query) {
  console.log(`Выполняю поиск по запросу: ${query}`);
  
  try {
    // Используем Google Custom Search API для поиска с заданными ключами
    const apiKey = "AIzaSyB5G-UXdHdCiygQjsIUfkIUpOtdP_00X50";
    const searchEngineId = "71f00319f5b8d4ff5";
    
    console.log(`Используем Google API с ключом: ${apiKey.substring(0, 10)}...`);
    
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;
    
    console.log(`Отправляем запрос к Google API...`);
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error(`Google Search API error: ${response.status}`);
      return `Не удалось выполнить поиск. Ошибка API: ${response.status}`;
    }
    
    const data = await response.json();
    console.log(`Получен ответ от Google API`);
    
    // Проверяем, есть ли специальные запросы, требующие дополнительной обработки
    const lowerQuery = query.toLowerCase();
    
    // Специальная обработка для запросов о погоде
    if (lowerQuery.includes('погода') || lowerQuery.includes('weather')) {
      // Определяем, запрашивается ли прогноз на неделю
      const isWeeklyForecast = lowerQuery.includes('недел') ||
                               lowerQuery.includes('week') ||
                               lowerQuery.includes('прогноз');
      
      return await fetchWeatherInfo(query, data.items, isWeeklyForecast);
    }
    
    // Специальная обработка для запросов о новостях
    if (lowerQuery.includes('новости') || lowerQuery.includes('news')) {
      return await fetchNewsInfo(query, data.items);
    }
    
    // Для остальных запросов извлекаем содержимое страниц
    return await fetchContentFromSearchResults(data.items);
  } catch (error) {
    console.error("Error during online search:", error);
    return `Произошла ошибка при выполнении поиска в интернете: ${error.message}`;
  }
}

// Функция для извлечения информации о погоде
async function fetchWeatherInfo(query, searchItems, isWeeklyForecast = false) {
  if (!searchItems || searchItems.length === 0) {
    return "По вашему запросу о погоде ничего не найдено.";
  }
  
  try {
    // Извлекаем название города из запроса
    const cityRegex = /погода\s+в\s+([а-яА-ЯёЁ\-\s]+)|weather\s+in\s+([a-zA-Z\-\s]+)/i;
    const cityMatch = query.match(cityRegex);
    const city = cityMatch ? (cityMatch[1] || cityMatch[2]) : null;
    
    // Пытаемся найти результаты с погодных сервисов
    const weatherSites = ['yandex.ru/pogoda', 'gismeteo.ru', 'weather.com', 'accuweather.com', 'rp5.ru'];
    
    // Сортируем результаты, чтобы погодные сайты были в начале
    const sortedItems = [...searchItems].sort((a, b) => {
      const aIsWeatherSite = weatherSites.some(site => a.link.includes(site));
      const bIsWeatherSite = weatherSites.some(site => b.link.includes(site));
      
      if (aIsWeatherSite && !bIsWeatherSite) return -1;
      if (!aIsWeatherSite && bIsWeatherSite) return 1;
      return 0;
    });
    
    // Пытаемся получить информацию с нескольких погодных сайтов для сравнения
    let weatherResults = [];
    let processedSites = 0;
    
    for (const item of sortedItems) {
      if (processedSites >= 2) break; // Ограничиваем количество обрабатываемых сайтов
      
      const isWeatherSite = weatherSites.some(site => item.link.includes(site));
      if (isWeatherSite) {
        try {
          console.log(`Извлекаем погоду с сайта: ${item.link}`);
          const weatherData = await fetchAndExtractWeatherData(item.link, isWeeklyForecast);
          
          if (weatherData) {
            weatherResults.push({
              source: item.link,
              data: weatherData
            });
            processedSites++;
          }
        } catch (e) {
          console.error(`Error extracting weather from ${item.link}:`, e);
        }
      }
    }
    
    // Если удалось получить информацию о погоде
    if (weatherResults.length > 0) {
      // Форматируем результат
      let result = '';
      
      // Добавляем заголовок с информацией о городе и текущей дате
      const currentDate = new Date().toLocaleString('ru-RU');
      result += `Погода${city ? ' в ' + city : ''}:\n\n`;
      
      // Добавляем информацию о текущей погоде
      for (const weather of weatherResults) {
        // Извлекаем домен из URL для отображения источника
        const domain = weather.source.match(/\/\/([^\/]+)/)[1];
        
        result += `По данным ${domain} на ${currentDate}:\n`;
        
        // Добавляем температуру, если она есть
        if (weather.data.temperature) {
          result += `Температура: ${weather.data.temperature}°C\n`;
        }
        
        // Добавляем описание погоды, если оно есть
        if (weather.data.description) {
          result += `Состояние: ${weather.data.description}\n`;
        }
        
        // Добавляем прогноз на неделю, если он запрашивался и доступен
        if (isWeeklyForecast && weather.data.forecast) {
          result += `\nПрогноз на ближайшие дни:\n${weather.data.forecast}\n`;
        }
        
        result += `\n`;
      }
      
      // Добавляем источники
      result += `Источники:\n`;
      for (const weather of weatherResults) {
        result += `- ${weather.source}\n`;
      }
      
      return result;
    }
    
    // Если не удалось извлечь информацию о погоде, пробуем общий подход
    const weatherItem = sortedItems.find(item =>
      weatherSites.some(site => item.link.includes(site))
    );
    
    if (weatherItem) {
      const weatherInfo = await fetchAndExtractContent(weatherItem.link, 'погода');
      return `Информация о погоде${city ? ' в ' + city : ''}:\n\n${weatherInfo}\n\nИсточник: ${weatherItem.link}`;
    }
    
    // Если все методы не сработали, возвращаем стандартные результаты
    let fallbackResults = `Информация о погоде${city ? ' в ' + city : ''}:\n\n`;
    
    for (let i = 0; i < Math.min(3, searchItems.length); i++) {
      const item = searchItems[i];
      fallbackResults += `${item.title}\n${item.snippet}\nИсточник: ${item.link}\n\n`;
    }
    
    return fallbackResults;
  } catch (error) {
    console.error("Error fetching weather info:", error);
    
    // Если произошла ошибка, возвращаем стандартные результаты
    let fallbackResults = "Информация о погоде:\n\n";
    
    for (let i = 0; i < Math.min(3, searchItems.length); i++) {
      const item = searchItems[i];
      fallbackResults += `${item.title}\n${item.snippet}\nИсточник: ${item.link}\n\n`;
    }
    
    return fallbackResults;
  }
}

// Функция для извлечения данных о погоде с веб-страницы
async function fetchAndExtractWeatherData(url, isWeeklyForecast = false) {
  try {
    // Проверяем, поддерживается ли URL
    if (!url.startsWith('http')) {
      return null;
    }
    
    // Устанавливаем таймаут для запроса
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд таймаут
    
    // Выполняем запрос
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Проверяем тип контента
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return null;
    }
    
    // Получаем текст страницы
    const html = await response.text();
    
    // Извлекаем основной текст
    const text = extractTextFromHTML(html);
    
    // Результат с данными о погоде
    const weatherData = {
      temperature: null,
      description: null,
      forecast: null
    };
    
    // Ищем температуру (более сложный подход)
    const tempRegexes = [
      /температура[:\s]+(-?\d+)[°˚º]C?/i,
      /(-?\d+)[°˚º]C/i,
      /(-?\d+)\s*градус/i,
      /сейчас[:\s]+(-?\d+)[°˚º]?/i,
      /температура воздуха[:\s]+(-?\d+)/i
    ];
    
    for (const regex of tempRegexes) {
      const match = text.match(regex);
      if (match) {
        weatherData.temperature = match[1];
        break;
      }
    }
    
    // Ищем описание погоды (расширенный список)
    const weatherDescRegexes = [
      /(ясно|солнечно|облачно|пасмурно|дождь|снег|гроза|туман|морось|ливень|метель|град|мокрый снег)/i,
      /(переменная облачность|небольшой дождь|сильный дождь|небольшой снег|сильный снег)/i
    ];
    
    for (const regex of weatherDescRegexes) {
      const match = text.match(regex);
      if (match) {
        weatherData.description = match[1].toLowerCase();
        break;
      }
    }
    
    // Если запрашивается прогноз на неделю, пытаемся его извлечь
    if (isWeeklyForecast) {
      // Ищем блок с прогнозом на неделю
      const forecastRegexes = [
        /прогноз на (\d+) дн[а-я]+[\s\S]{10,500}?(?=\n\n|\.|$)/i,
        /прогноз погоды на неделю[\s\S]{10,500}?(?=\n\n|\.|$)/i,
        /на неделю[\s\S]{10,500}?(?=\n\n|\.|$)/i
      ];
      
      for (const regex of forecastRegexes) {
        const match = text.match(regex);
        if (match) {
          // Ограничиваем размер прогноза
          const forecast = match[0].substring(0, 500);
          weatherData.forecast = forecast;
          break;
        }
      }
      
      // Если не нашли прогноз, пытаемся собрать информацию о днях недели
      if (!weatherData.forecast) {
        const daysRegex = /(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)[^\n]*?(-?\d+)[°˚º]?/gi;
        let daysMatch;
        let daysInfo = [];
        
        while ((daysMatch = daysRegex.exec(text)) !== null) {
          daysInfo.push(`${daysMatch[1]}: ${daysMatch[2]}°C`);
        }
        
        if (daysInfo.length > 0) {
          weatherData.forecast = daysInfo.join('\n');
        }
      }
    }
    
    return weatherData;
  } catch (error) {
    console.error(`Error fetching weather data from ${url}: ${error.message}`);
    return null;
  }
}

// Функция для извлечения новостей
async function fetchNewsInfo(query, searchItems) {
  if (!searchItems || searchItems.length === 0) {
    return "По вашему запросу о новостях ничего не найдено.";
  }
  
  try {
    // Собираем информацию из нескольких новостных источников
    let newsResults = "Последние новости:\n\n";
    
    // Берем до 5 новостных результатов
    const newsItems = searchItems.slice(0, 5);
    
    for (const item of newsItems) {
      // Добавляем заголовок и сниппет
      newsResults += `${item.title}\n${item.snippet}\nИсточник: ${item.link}\n\n`;
      
      // Для первого результата пытаемся извлечь больше содержимого
      if (item === newsItems[0]) {
        try {
          const content = await fetchAndExtractContent(item.link, 'новости');
          if (content && content.length > item.snippet.length) {
            newsResults += `Подробнее: ${content}\n\n`;
          }
        } catch (e) {
          console.error(`Error extracting news content: ${e.message}`);
        }
      }
    }
    
    return newsResults;
  } catch (error) {
    console.error("Error fetching news info:", error);
    
    // Если не удалось извлечь информацию, возвращаем стандартные результаты
    let fallbackResults = "Новости:\n\n";
    
    for (let i = 0; i < Math.min(3, searchItems.length); i++) {
      const item = searchItems[i];
      fallbackResults += `${item.title}\n${item.snippet}\nИсточник: ${item.link}\n\n`;
    }
    
    return fallbackResults;
  }
}

// Функция для извлечения содержимого из результатов поиска
async function fetchContentFromSearchResults(searchItems) {
  if (!searchItems || searchItems.length === 0) {
    return "По вашему запросу ничего не найдено.";
  }
  
  try {
    // Берем первые 3 результата
    const topResults = searchItems.slice(0, 3);
    let searchResults = "Результаты поиска:\n\n";
    
    for (const item of topResults) {
      searchResults += `${item.title}\n${item.snippet}\nИсточник: ${item.link}\n\n`;
      
      // Для первого результата пытаемся извлечь больше содержимого
      if (item === topResults[0]) {
        try {
          const content = await fetchAndExtractContent(item.link);
          if (content && content.length > item.snippet.length) {
            searchResults += `Дополнительная информация: ${content}\n\n`;
          }
        } catch (e) {
          console.error(`Error extracting content: ${e.message}`);
        }
      }
    }
    
    return searchResults;
  } catch (error) {
    console.error("Error processing search results:", error);
    
    // Если произошла ошибка, возвращаем базовые результаты
    let fallbackResults = "Результаты поиска:\n\n";
    
    for (let i = 0; i < Math.min(3, searchItems.length); i++) {
      const item = searchItems[i];
      fallbackResults += `${item.title}\n${item.snippet}\nИсточник: ${item.link}\n\n`;
    }
    
    return fallbackResults;
  }
}

// Функция для извлечения содержимого веб-страницы
async function fetchAndExtractContent(url, context = '') {
  try {
    // Проверяем, поддерживается ли URL
    if (!url.startsWith('http')) {
      return null;
    }
    
    // Устанавливаем таймаут для запроса
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
    
    // Выполняем запрос
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Проверяем тип контента
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return null;
    }
    
    // Получаем текст страницы
    const html = await response.text();
    
    // Извлекаем основной текст (простая реализация)
    let text = extractTextFromHTML(html);
    
    // Если контекст - погода, пытаемся найти информацию о погоде
    if (context === 'погода') {
      const weatherInfo = extractWeatherInfo(html, text);
      if (weatherInfo) {
        return weatherInfo;
      }
    }
    
    // Ограничиваем размер текста
    if (text.length > 1000) {
      text = text.substring(0, 1000) + '...';
    }
    
    return text;
  } catch (error) {
    console.error(`Error fetching content from ${url}: ${error.message}`);
    return null;
  }
}

// Простая функция для извлечения текста из HTML
function extractTextFromHTML(html) {
  // Удаляем HTML-теги
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Удаляем лишние пробелы
  text = text.replace(/\s+/g, ' ').trim();
  
  // Декодируем HTML-сущности
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");
  
  return text;
}

// Функция для извлечения информации о погоде
function extractWeatherInfo(html, text) {
  // Ищем температуру (простой подход)
  const tempRegex = /(-?\d+)[°˚º]C|температура[:\s]+(-?\d+)/i;
  const tempMatch = text.match(tempRegex);
  
  // Ищем описание погоды
  const weatherDescRegex = /(ясно|облачно|пасмурно|дождь|снег|гроза|туман)/i;
  const weatherDescMatch = text.match(weatherDescRegex);
  
  if (tempMatch || weatherDescMatch) {
    let weatherInfo = 'Погода: ';
    
    if (tempMatch) {
      const temp = tempMatch[1] || tempMatch[2];
      weatherInfo += `температура ${temp}°C, `;
    }
    
    if (weatherDescMatch) {
      weatherInfo += weatherDescMatch[1].toLowerCase();
    }
    
    return weatherInfo;
  }
  
  return null;
}

// Модификатор сообщений для поиска в интернете
export async function onlineSearchModifier(history, message) {
  // Если поиск в интернете не включен, возвращаем исходные данные
  if (!ENV.USER_CONFIG.IS_ONLINE) {
    return { history, message };
  }
  
  // Извлекаем текст запроса
  const content = typeof message.content === 'string'
    ? message.content
    : message.content.find(item => item.type === 'text')?.text || '';
  
  // Если сообщение уже содержит инструкцию для поиска, не модифицируем
  if (content.includes('[SEARCH]') || content.includes('[ПОИСК]')) {
    return { history, message };
  }
  
  // Выполняем поиск в интернете
  const searchResults = await searchOnline(content);
  
  // Добавляем результаты поиска и инструкцию
  const currentDate = new Date().toLocaleString('ru-RU');
  
  // Создаем новое сообщение с инструкцией и результатами поиска
  let newMessage = { ...message };
  
  if (typeof message.content === 'string') {
    newMessage.content = `[SEARCH] ${message.content}\n\nСегодня ${currentDate}.\n\n${searchResults}\n\nПожалуйста, используй эту актуальную информацию для ответа на вопрос.`;
  } else if (Array.isArray(message.content)) {
    // Для мультимодальных сообщений модифицируем только текстовую часть
    newMessage.content = message.content.map(item => {
      if (item.type === 'text') {
        return {
          ...item,
          text: `[SEARCH] ${item.text}\n\nСегодня ${currentDate}.\n\n${searchResults}\n\nПожалуйста, используй эту актуальную информацию для ответа на вопрос.`
        };
      }
      return item;
    });
  }
  
  return { history, message: newMessage };
}
