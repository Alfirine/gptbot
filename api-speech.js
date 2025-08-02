// api-speech.js - Интеграция с Google Speech-to-Text API

import { ENV } from './config.js';
import { createTelegramBotAPI } from './api.js';

/**
 * Константы для Google Speech-to-Text API
 */
const SPEECH_CONFIG = {
  LANGUAGE: 'ru-RU',
  ENCODING: 'OGG_OPUS',
  SAMPLE_RATE: 48000,
  MODEL: 'latest_long',
  ENABLE_AUTOMATIC_PUNCTUATION: true,
  ENABLE_PROFANITY_FILTER: false
};

/**
 * Получить файл от Telegram Bot API
 * @param {string} fileId - ID файла в Telegram
 * @param {string} botToken - Токен бота
 * @returns {Promise<{buffer: ArrayBuffer, mimeType: string}>}
 */
async function getTelegramFile(fileId, botToken) {
  try {
    const api = createTelegramBotAPI(botToken);
    
    // Получаем информацию о файле (используем WithReturns для получения JSON)
    const fileInfo = await api.getFileWithReturns({ file_id: fileId });
    console.log('Telegram getFile response:', fileInfo);
    
    if (!fileInfo || !fileInfo.ok) {
      throw new Error(`Failed to get file info: ${fileInfo?.description || 'Unknown error'}`);
    }
    
    if (!fileInfo.result || !fileInfo.result.file_path) {
      throw new Error('File path not found in Telegram response');
    }
    
    const filePath = fileInfo.result.file_path;
    const fileUrl = `${ENV.TELEGRAM_API_DOMAIN}/file/bot${botToken}/${filePath}`;
    
    console.log('Downloading file from:', fileUrl);
    
    // Скачиваем файл
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type') || 'audio/ogg';
    
    console.log('File downloaded successfully, size:', buffer.byteLength, 'mime:', mimeType);
    
    return { buffer, mimeType };
  } catch (error) {
    console.error('Error downloading Telegram file:', error);
    throw new Error(`Ошибка загрузки файла: ${error.message}`);
  }
}

/**
 * Конвертировать аудио файл в base64 для Google Speech-to-Text
 * @param {ArrayBuffer} audioBuffer - Буфер аудио файла
 * @returns {string} Base64 строка
 */
function audioBufferToBase64(audioBuffer) {
  try {
    // Конвертируем ArrayBuffer в base64
    const uint8Array = new Uint8Array(audioBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error('Error converting audio to base64:', error);
    throw error;
  }
}

/**
 * Определить конфигурацию аудио на основе MIME типа
 * @param {string} mimeType - MIME тип файла
 * @returns {object} Конфигурация аудио
 */
function getAudioConfig(mimeType) {
  const config = {
    encoding: 'OGG_OPUS',
    sampleRateHertz: 48000,
    languageCode: SPEECH_CONFIG.LANGUAGE
  };

  // Определяем кодировку на основе MIME типа
  if (mimeType.includes('ogg')) {
    config.encoding = 'OGG_OPUS';
    config.sampleRateHertz = 48000;
  } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
    config.encoding = 'MP3';
    config.sampleRateHertz = 44100;
  } else if (mimeType.includes('wav')) {
    config.encoding = 'LINEAR16';
    config.sampleRateHertz = 16000;
  } else if (mimeType.includes('flac')) {
    config.encoding = 'FLAC';
    config.sampleRateHertz = 44100;
  }

  return config;
}

/**
 * Распознать речь с помощью Google Speech-to-Text API
 * @param {string} fileId - ID аудио файла в Telegram
 * @param {string} botToken - Токен бота
 * @param {object} context - Контекст пользователя
 * @returns {Promise<string>} Распознанный текст
 */
export async function recognizeSpeech(fileId, botToken, context) {
  try {
    // Получаем API ключ из конфигурации
    const apiKey = context.USER_CONFIG?.GOOGLE_SPEECH_API_KEY || ENV.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google Speech API key not configured');
    }

    // Скачиваем аудио файл
    console.log('Downloading audio file from Telegram...');
    const { buffer, mimeType } = await getTelegramFile(fileId, botToken);
    
    // Конвертируем в base64
    console.log('Converting audio to base64...');
    const audioBase64 = audioBufferToBase64(buffer);
    
    // Получаем конфигурацию аудио
    const audioConfig = getAudioConfig(mimeType);
    console.log('Audio config:', audioConfig);
    
    // Подготавливаем запрос к Google Speech-to-Text API
    const requestBody = {
      config: {
        encoding: audioConfig.encoding,
        sampleRateHertz: audioConfig.sampleRateHertz,
        languageCode: audioConfig.languageCode,
        enableAutomaticPunctuation: SPEECH_CONFIG.ENABLE_AUTOMATIC_PUNCTUATION,
        profanityFilter: SPEECH_CONFIG.ENABLE_PROFANITY_FILTER,
        model: SPEECH_CONFIG.MODEL
      },
      audio: {
        content: audioBase64
      }
    };

    // Отправляем запрос к Google Speech-to-Text API
    console.log('Sending request to Google Speech-to-Text API...');
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Speech API error:', errorText);
      throw new Error(`Google Speech API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Google Speech API response:', result);

    // Извлекаем распознанный текст
    if (result.results && result.results.length > 0) {
      const transcript = result.results
        .map(r => r.alternatives?.[0]?.transcript || '')
        .filter(text => text.trim().length > 0)
        .join(' ')
        .trim();

      if (transcript) {
        console.log('Recognized text:', transcript);
        return transcript;
      }
    }

    throw new Error('Не удалось распознать речь в аудиосообщении');

  } catch (error) {
    console.error('Speech recognition error:', error);
    throw new Error(`Ошибка распознавания речи: ${error.message}`);
  }
}

/**
 * Проверить, поддерживается ли аудио формат
 * @param {string} mimeType - MIME тип файла
 * @returns {boolean}
 */
export function isSupportedAudioFormat(mimeType) {
  const supportedFormats = [
    'audio/ogg',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/flac'
  ];
  
  return supportedFormats.some(format => mimeType.includes(format));
}

/**
 * Получить информацию об аудио файле из сообщения Telegram
 * @param {object} message - Сообщение Telegram
 * @returns {object|null} Информация об аудио файле или null
 */
export function extractAudioInfo(message) {
  let fileId = null;
  let mimeType = null;
  let duration = null;
  let fileType = null;

  // Проверяем голосовое сообщение
  if (message.voice) {
    fileId = message.voice.file_id;
    mimeType = message.voice.mime_type || 'audio/ogg';
    duration = message.voice.duration;
    fileType = 'voice';
  }
  // Проверяем аудио файл
  else if (message.audio) {
    fileId = message.audio.file_id;
    mimeType = message.audio.mime_type || 'audio/mpeg';
    duration = message.audio.duration;
    fileType = 'audio';
  }
  // Проверяем видео сообщение (круглое видео)
  else if (message.video_note) {
    fileId = message.video_note.file_id;
    mimeType = 'video/mp4'; // Обычно видео сообщения в mp4
    duration = message.video_note.duration;
    fileType = 'video_note';
  }

  if (fileId) {
    return {
      fileId,
      mimeType,
      duration,
      fileType,
      isSupported: isSupportedAudioFormat(mimeType) || fileType === 'video_note'
    };
  }

  return null;
}