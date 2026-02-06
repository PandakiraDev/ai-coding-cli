// diff-display.js - Wyświetlanie zmian w kodzie w stylu diff

import chalk from 'chalk';

/**
 * @typedef {Object} FileDiff
 * @property {string} filename - nazwa pliku
 * @property {string} action - 'modify' | 'create' | 'delete'
 * @property {Array<{type: string, content: string}>} changes - lista zmian
 */

/**
 * Parsuje blok kodu szukając formatu diff.
 * Obsługuje format:
 * - Linie zaczynające się od + (dodane)
 * - Linie zaczynające się od - (usunięte)
 * - Linie zaczynające się od @@ (kontekst)
 * - Komentarze // FILE: nazwa.js
 *
 * @param {string} code - zawartość bloku kodu
 * @param {string} [language] - język bloku
 * @returns {FileDiff|null}
 */
export function parseDiffBlock(code, language = '') {
  const lines = code.split('\n');

  // Szukaj nazwy pliku w różnych formatach
  let filename = null;
  const filePatterns = [
    /^\/\/\s*FILE:\s*(.+)$/i,
    /^#\s*FILE:\s*(.+)$/i,
    /^---\s*(.+)$/,
    /^Plik:\s*(.+)$/i,
    /^File:\s*(.+)$/i,
  ];

  for (const line of lines) {
    for (const pattern of filePatterns) {
      const match = line.match(pattern);
      if (match) {
        filename = match[1].trim();
        break;
      }
    }
    if (filename) break;
  }

  // Sprawdź czy to format diff (ma linie + lub -)
  const hasDiffLines = lines.some(l =>
    (l.startsWith('+') && !l.startsWith('+++')) ||
    (l.startsWith('-') && !l.startsWith('---'))
  );

  if (!hasDiffLines) return null;

  const changes = [];

  for (const line of lines) {
    // Pomiń nagłówki diff i komentarze o pliku
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (filePatterns.some(p => p.test(line))) continue;
    if (line.startsWith('@@')) {
      changes.push({ type: 'context', content: line });
      continue;
    }

    if (line.startsWith('+')) {
      changes.push({ type: 'add', content: line.slice(1) });
    } else if (line.startsWith('-')) {
      changes.push({ type: 'remove', content: line.slice(1) });
    } else {
      changes.push({ type: 'unchanged', content: line.startsWith(' ') ? line.slice(1) : line });
    }
  }

  return {
    filename: filename || 'nieznany plik',
    action: 'modify',
    changes,
  };
}

/**
 * Wyświetla diff w terminalu z kolorami.
 * @param {FileDiff} diff
 */
export function displayDiff(diff) {
  const border = '─'.repeat(70);

  // Nagłówek z nazwą pliku
  console.log(chalk.blue(`\n┌─ 📄 ${diff.filename} `  + '─'.repeat(Math.max(0, 65 - diff.filename.length)) + '┐'));

  for (const change of diff.changes) {
    switch (change.type) {
      case 'add':
        // Zielone tło dla dodanych linii
        console.log(chalk.bgGreen.black(` + ${change.content.padEnd(67)} `));
        break;
      case 'remove':
        // Czerwone tło dla usuniętych linii
        console.log(chalk.bgRed.white(` - ${change.content.padEnd(67)} `));
        break;
      case 'context':
        console.log(chalk.gray(` ${change.content}`));
        break;
      case 'unchanged':
        console.log(chalk.gray(`   ${change.content}`));
        break;
    }
  }

  console.log(chalk.blue(`└${border}┘\n`));
}

/**
 * Parsuje odpowiedź AI i wyświetla wszystkie znalezione diffy.
 * @param {string} response - pełna odpowiedź AI
 * @param {Array<{language: string, code: string}>} codeBlocks - bloki kodu z odpowiedzi
 * @returns {number} - liczba wyświetlonych diffów
 */
export function processAndDisplayDiffs(response, codeBlocks) {
  let displayedCount = 0;

  for (const block of codeBlocks) {
    // Sprawdź czy blok jest w formacie diff
    if (block.language === 'diff' || block.language === 'patch') {
      const diff = parseDiffBlock(block.code, block.language);
      if (diff) {
        displayDiff(diff);
        displayedCount++;
      }
      continue;
    }

    // Sprawdź czy zwykły blok kodu ma format diff
    const diff = parseDiffBlock(block.code, block.language);
    if (diff && diff.changes.length > 0) {
      displayDiff(diff);
      displayedCount++;
    }
  }

  return displayedCount;
}

/**
 * Tworzy prosty diff między starym a nowym kodem.
 * @param {string} oldCode - stary kod
 * @param {string} newCode - nowy kod
 * @param {string} filename - nazwa pliku
 * @returns {FileDiff}
 */
export function createSimpleDiff(oldCode, newCode, filename) {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  const changes = [];

  // Prosty algorytm diff (linia po linii)
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      changes.push({ type: 'add', content: newLine });
    } else if (newLine === undefined) {
      changes.push({ type: 'remove', content: oldLine });
    } else if (oldLine !== newLine) {
      changes.push({ type: 'remove', content: oldLine });
      changes.push({ type: 'add', content: newLine });
    } else {
      changes.push({ type: 'unchanged', content: oldLine });
    }
  }

  return { filename, action: 'modify', changes };
}
