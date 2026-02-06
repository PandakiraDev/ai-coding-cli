// ollama.js - Komunikacja z Ollama API (streaming) + tryb demo

import axios from 'axios';
import { CONFIG, OLLAMA_URL } from './config.js';
import { getContextualDemoResponse } from './demo-responses.js';
import { logger } from './logger.js';

/**
 * Streaming z prawdziwego Ollama /api/chat.
 * Parsuje newline-delimited JSON.
 *
 * @param {Array<{role:string,content:string}>} messages - okno wiadomości
 * @param {(token:string)=>void} onToken - callback na każdy fragment tekstu
 * @param {(fullText:string)=>void} onComplete - callback po zakończeniu
 * @param {(error:Error)=>void} onError - callback na błąd
 * @param {AbortSignal} [abortSignal] - sygnał do przerwania
 */
export async function streamOllama(messages, onToken, onComplete, onError, abortSignal) {
  let fullText = '';
  let completed = false;
  let buffer = '';

  let finalStats = null;
  const startTime = Date.now();

  logger.info('OLLAMA', `Wysyłam request do ${OLLAMA_URL}`);
  logger.debug('OLLAMA', `Model: ${CONFIG.MODEL_NAME}, Wiadomości: ${messages.length}`);
  logger.trace('OLLAMA', 'Payload:', messages.slice(-2)); // Ostatnie 2 wiadomości

  const finish = (aborted = false) => {
    if (!completed) {
      completed = true;
      const duration = Date.now() - startTime;
      if (aborted) {
        finalStats = { ...finalStats, aborted: true };
        logger.warn('OLLAMA', `Przerwano po ${duration}ms, otrzymano ${fullText.length} znaków`);
      } else {
        logger.info('OLLAMA', `Zakończono po ${duration}ms, ${fullText.length} znaków`);
        logger.debug('OLLAMA', 'Stats:', finalStats);
      }
      onComplete(fullText, finalStats);
    }
  };

  // Obsługa przerwania
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      logger.debug('OLLAMA', 'Otrzymano sygnał abort');
      finish(true);
    });
  }

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
        signal: abortSignal,
      }
    );

    logger.debug('OLLAMA', 'Połączenie nawiązane, streaming...');

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
        logger.error('OLLAMA', `Błąd streamu: ${err.message}`);
        onError(err);
      }
    });
  } catch (err) {
    if (!completed) {
      completed = true;
      logger.error('OLLAMA', `Błąd połączenia: ${err.message}`, err.code);
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
 * @param {{ messages?: Array<{role:string,content:string}>, hasProjectContext?: boolean, abortSignal?: AbortSignal }} [opts]
 */
export async function streamDemo(userInput, onToken, onComplete, opts = {}) {
  const { messages = [], hasProjectContext = false, abortSignal } = opts;
  const text = getContextualDemoResponse(userInput, messages, hasProjectContext);

  // Dzielimy na tokeny: słowa + whitespace/interpunkcja (zachowujemy formatowanie)
  const tokens = text.match(/\S+|\s+/g) || [text];
  let idx = 0;
  let aborted = false;

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      // Sprawdź czy przerwano
      if (abortSignal?.aborted || aborted) {
        clearInterval(timer);
        const partialText = tokens.slice(0, idx).join('');
        onComplete(partialText, { estimatedTokens: Math.ceil(partialText.length / 4), aborted: true });
        resolve();
        return;
      }

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

    // Listener dla przerwania
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        aborted = true;
      });
    }
  });
}

/**
 * Sprawdzenie czy Ollama jest dostępna (ping /api/tags).
 * @returns {Promise<boolean>}
 */
export async function checkConnection() {
  if (CONFIG.DEMO_MODE) {
    logger.debug('OLLAMA', 'Tryb demo - pomijam sprawdzenie połączenia');
    return true;
  }

  const url = `http://${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}/api/tags`;
  logger.debug('OLLAMA', `Sprawdzam połączenie: ${url}`);

  try {
    await axios.get(url, { timeout: 5000 });
    logger.info('OLLAMA', 'Połączenie OK');
    return true;
  } catch (err) {
    logger.warn('OLLAMA', `Brak połączenia: ${err.message}`);
    return false;
  }
}
