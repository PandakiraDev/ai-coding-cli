// validator.js - Walidacja i sanityzacja inputu użytkownika

import { CONFIG } from './config.js';

// Wzorce potencjalnego prompt injection
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+/i,
  /new\s+instructions?\s*:/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /<\|im_start\|>/i,
];

/**
 * Usuwa znaki kontrolne z tekstu (zachowuje newline i tab)
 */
function removeControlChars(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Waliduje i sanityzuje input użytkownika.
 * @param {string} text - surowy tekst od użytkownika
 * @returns {{ valid: boolean, sanitized: string, warnings: string[] }}
 */
export function validateInput(text) {
  const warnings = [];

  if (text === null || text === undefined) {
    return { valid: false, sanitized: '', warnings: ['Pusty input'] };
  }

  const str = String(text);

  if (str.trim().length === 0) {
    return { valid: false, sanitized: '', warnings: ['Pusty input'] };
  }

  // Sanityzacja - usunięcie znaków kontrolnych
  let sanitized = removeControlChars(str);

  // Sprawdzenie długości
  if (sanitized.length > CONFIG.MAX_INPUT_LENGTH) {
    sanitized = sanitized.slice(0, CONFIG.MAX_INPUT_LENGTH);
    warnings.push(`Input obcięty do ${CONFIG.MAX_INPUT_LENGTH} znaków`);
  } else if (sanitized.length > CONFIG.WARN_INPUT_LENGTH) {
    warnings.push(`Długi input (${sanitized.length} znaków)`);
  }

  // Detekcja prompt injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push('Wykryto potencjalny prompt injection');
      break;
    }
  }

  return { valid: true, sanitized: sanitized.trim(), warnings };
}
