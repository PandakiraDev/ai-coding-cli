// history.js - Persystencja konwersacji i sliding window

import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { CONFIG } from './config.js';

/**
 * Tworzy katalog historii jeśli nie istnieje.
 */
export async function initHistoryDir() {
  await mkdir(CONFIG.HISTORY_DIR, { recursive: true });
}

/**
 * Generuje unikalny ID konwersacji: YYYYMMDD-HHmmss-<4 hex>
 */
export function generateConversationId() {
  const now = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const hex = randomBytes(2).toString('hex');
  return `${date}-${time}-${hex}`;
}

/**
 * Sanityzacja ID - zapobiega path traversal.
 */
export function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9\-]/g, '');
}

/**
 * Tworzy nową, pustą strukturę konwersacji.
 */
export function createConversation() {
  const id = generateConversationId();
  return {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    model: CONFIG.MODEL_NAME,
    messages: [],
  };
}

/**
 * Zapisuje konwersację do pliku JSON.
 */
export async function saveConversation(conv) {
  const safeId = sanitizeId(conv.id);
  const filePath = join(CONFIG.HISTORY_DIR, `${safeId}.json`);
  conv.updatedAt = new Date().toISOString();
  await writeFile(filePath, JSON.stringify(conv, null, 2), 'utf-8');
}

/**
 * Wczytuje konwersację z pliku.
 */
export async function loadConversation(id) {
  const safeId = sanitizeId(id);
  const filePath = join(CONFIG.HISTORY_DIR, `${safeId}.json`);
  const data = await readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

/**
 * Lista zapisanych konwersacji (id, data, podgląd pierwszej wiadomości).
 */
export async function listConversations() {
  let files;
  try {
    files = await readdir(CONFIG.HISTORY_DIR);
  } catch {
    return [];
  }

  const conversations = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = await readFile(join(CONFIG.HISTORY_DIR, file), 'utf-8');
      const conv = JSON.parse(data);
      const firstUserMsg = conv.messages?.find(m => m.role === 'user');
      conversations.push({
        id: conv.id,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages?.length ?? 0,
        preview: firstUserMsg ? firstUserMsg.content.slice(0, 80) : '(pusta)',
      });
    } catch {
      // pomijamy uszkodzone pliki
    }
  }

  // sortuj od najnowszych
  conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return conversations;
}

/**
 * Kompresuje stary feedback komend — zachowuje nagłówek + 5 ostatnich linii.
 * @param {string} content
 * @returns {string}
 */
function compressFeedbackMessage(content) {
  if (!content.includes('[WYNIKI WYKONANIA KOMEND]')) return content;

  const lines = content.split('\n');
  if (lines.length <= 10) return content;

  // Nagłówek: pierwsze 3 linie (tytuł, cwd, pusta)
  const header = lines.slice(0, 3);
  // Ostatnie 5 linii
  const tail = lines.slice(-5);
  const omitted = lines.length - header.length - tail.length;

  return [...header, `... (skrócono ${omitted} linii) ...`, ...tail].join('\n');
}

/**
 * Buduje okno wiadomości dla API /api/chat.
 * - Zawsze system prompt na początku
 * - Zawsze zachowuje pierwszą wiadomość użytkownika z prefixem [ORYGINALNE ZADANIE]
 * - Kompresuje stare feedbacki komend
 * - Potem ostatnie maxN wiadomości
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} systemPrompt
 * @param {number} [maxN] - maksymalna liczba wiadomości (domyślnie z CONFIG)
 * @returns {Array<{role: string, content: string}>}
 */
export function buildMessageWindow(messages, systemPrompt, maxN) {
  const max = maxN ?? CONFIG.MAX_HISTORY_MESSAGES;

  // Znajdź pierwszą wiadomość użytkownika (oryginalne zadanie)
  const firstUserIdx = messages.findIndex(m => m.role === 'user');

  // Weź ostatnie max wiadomości
  const recentWindow = messages.slice(-max);

  // Sprawdź czy pierwsza wiadomość użytkownika jest już w oknie
  const firstUserInWindow = firstUserIdx >= 0 && firstUserIdx >= messages.length - max;

  const result = [{ role: 'system', content: systemPrompt }];

  // Dodaj pierwszą wiadomość użytkownika z prefixem jeśli nie ma jej w oknie
  if (firstUserIdx >= 0 && !firstUserInWindow) {
    const original = messages[firstUserIdx];
    result.push({
      role: 'user',
      content: `[ORYGINALNE ZADANIE] ${original.content}`,
    });
  }

  // Dodaj wiadomości z okna, kompresując stare feedbacki
  for (const msg of recentWindow) {
    // Kompresuj feedbacki komend (oprócz ostatnich 4 wiadomości)
    const isRecent = messages.indexOf(msg) >= messages.length - 4;
    if (msg.role === 'user' && !isRecent && msg.content.includes('[WYNIKI WYKONANIA KOMEND]')) {
      result.push({ ...msg, content: compressFeedbackMessage(msg.content) });
    } else {
      result.push(msg);
    }
  }

  return result;
}

// --- Auto-save ---
let autoSaveTimer = null;

/**
 * Uruchamia auto-save co CONFIG.AUTO_SAVE_INTERVAL ms.
 * @param {() => object} getConversation - callback zwracający aktualną konwersację
 */
export function startAutoSave(getConversation) {
  stopAutoSave();
  autoSaveTimer = setInterval(async () => {
    try {
      const conv = getConversation();
      if (conv && conv.messages.length > 0) {
        await saveConversation(conv);
      }
    } catch {
      // cicha obsługa błędu auto-save
    }
  }, CONFIG.AUTO_SAVE_INTERVAL);
}

/**
 * Zatrzymuje auto-save.
 */
export function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}
