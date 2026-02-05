// ollama.js - Komunikacja z Ollama API (streaming) + tryb demo

import axios from 'axios';
import { CONFIG, OLLAMA_URL } from './config.js';
import { getContextualDemoResponse } from './demo-responses.js';

/**
 * Streaming z prawdziwego Ollama /api/chat.
 * Parsuje newline-delimited JSON.
 *
 * @param {Array<{role:string,content:string}>} messages - okno wiadomości
 * @param {(token:string)=>void} onToken - callback na każdy fragment tekstu
 * @param {(fullText:string)=>void} onComplete - callback po zakończeniu
 * @param {(error:Error)=>void} onError - callback na błąd
 */
export async function streamOllama(messages, onToken, onComplete, onError) {
  let fullText = '';
  let completed = false;
  let buffer = '';

  let finalStats = null;

  const finish = () => {
    if (!completed) {
      completed = true;
      onComplete(fullText, finalStats);
    }
  };

  try {
    const response = await axios.post(
      OLLAMA_URL,
      {
        model: CONFIG.MODEL_NAME,
        messages,
        stream: true,
      },
      {
        timeout: CONFIG.REQUEST_TIMEOUT,
        responseType: 'stream',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      // zachowaj ostatnią (potencjalnie niepełną) linię w buforze
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            const token = json.message.content;
            fullText += token;
            onToken(token);
          }
          if (json.done) {
            finalStats = {
              eval_count: json.eval_count,
              eval_duration: json.eval_duration,
              prompt_eval_count: json.prompt_eval_count,
              prompt_eval_duration: json.prompt_eval_duration,
            };
            finish();
          }
        } catch {
          // nieparsowalna linia — ignorujemy
        }
      }
    });

    response.data.on('end', () => {
      // przetwórz resztę bufora
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer);
          if (json.message?.content) {
            const token = json.message.content;
            fullText += token;
            onToken(token);
          }
        } catch {
          // ignorujemy
        }
      }
      finish();
    });

    response.data.on('error', (err) => {
      if (!completed) {
        completed = true;
        onError(err);
      }
    });
  } catch (err) {
    if (!completed) {
      completed = true;
      onError(err);
    }
  }
}

/**
 * Symulacja streamingu w trybie demo.
 * Streamuje word-by-word (realistycznie szybko) zamiast char-by-char.
 * Przyjmuje pełną historię konwersacji i info o kontekście projektu,
 * dzięki czemu demo-engine dobiera odpowiedzi kontekstowo.
 *
 * @param {string} userInput - ostatni input użytkownika
 * @param {(token:string)=>void} onToken
 * @param {(fullText:string)=>void} onComplete
 * @param {{ messages?: Array<{role:string,content:string}>, hasProjectContext?: boolean }} [opts]
 */
export async function streamDemo(userInput, onToken, onComplete, opts = {}) {
  const { messages = [], hasProjectContext = false } = opts;
  const text = getContextualDemoResponse(userInput, messages, hasProjectContext);

  // Dzielimy na tokeny: słowa + whitespace/interpunkcja (zachowujemy formatowanie)
  const tokens = text.match(/\S+|\s+/g) || [text];
  let idx = 0;

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (idx >= tokens.length) {
        clearInterval(timer);
        const estimatedTokens = Math.ceil(text.length / 4);
        onComplete(text, { estimatedTokens });
        resolve();
        return;
      }
      // 1-3 tokeny na tick — szybkie ale czytelne
      const count = Math.min(1 + Math.floor(Math.random() * 3), tokens.length - idx);
      const chunk = tokens.slice(idx, idx + count).join('');
      idx += count;
      onToken(chunk);
    }, CONFIG.DEMO_STREAM_CHAR_DELAY);
  });
}

/**
 * Sprawdzenie czy Ollama jest dostępna (ping /api/tags).
 * @returns {Promise<boolean>}
 */
export async function checkConnection() {
  if (CONFIG.DEMO_MODE) return true;

  try {
    await axios.get(
      `http://${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}/api/tags`,
      { timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}
