// parser.js - State-machine parser bloków kodu z odpowiedzi AI

/**
 * @typedef {Object} CodeBlock
 * @property {string} language - język bloku (np. 'javascript', 'powershell')
 * @property {string} code - zawartość bloku
 * @property {number} startLine - numer linii rozpoczynającej blok (fence)
 * @property {number} endLine - numer linii kończącej blok (fence)
 * @property {boolean} [incomplete] - true jeśli blok nie został zamknięty
 */

const FENCE_REGEX = /^(`{3,}|~{3,})(\w*)\s*$/;

/**
 * Ekstrakcja bloków kodu z tekstu markdown.
 * Obsługuje: backtick/tilde fences, 4+ backticki, niezamknięte bloki.
 *
 * @param {string} text - tekst odpowiedzi AI
 * @returns {CodeBlock[]}
 */
export function extractCodeBlocks(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split('\n');
  const blocks = [];

  /** @type {'NORMAL'|'IN_CODE'} */
  let state = 'NORMAL';
  let currentFenceChar = '';
  let currentFenceLen = 0;
  let currentLang = '';
  let currentLines = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = FENCE_REGEX.exec(line);

    if (state === 'NORMAL') {
      if (match) {
        // Otwieramy nowy blok kodu
        currentFenceChar = match[1][0]; // '`' lub '~'
        currentFenceLen = match[1].length;
        currentLang = match[2] || 'plaintext';
        currentLines = [];
        startLine = i + 1; // 1-based
        state = 'IN_CODE';
      }
    } else {
      // state === 'IN_CODE'
      if (match && match[1][0] === currentFenceChar && match[1].length >= currentFenceLen && !match[2]) {
        // Zamykamy blok
        blocks.push({
          language: currentLang,
          code: currentLines.join('\n'),
          startLine,
          endLine: i + 1,
        });
        state = 'NORMAL';
      } else {
        currentLines.push(line);
      }
    }
  }

  // Niezamknięty blok
  if (state === 'IN_CODE' && currentLines.length > 0) {
    blocks.push({
      language: currentLang,
      code: currentLines.join('\n'),
      startLine,
      endLine: lines.length,
      incomplete: true,
    });
  }

  return blocks;
}
