// mentions.js - Obsługa @mentions dla plików i folderów

import { promises as fs } from 'fs';
import { resolve, basename, extname, relative } from 'path';
import chalk from 'chalk';
import { CONFIG } from './config.js';

/**
 * @typedef {Object} Mention
 * @property {string} original - oryginalny tekst @mention
 * @property {string} path - rozwiązana ścieżka
 * @property {'file'|'directory'|'notfound'} type - typ
 */

/**
 * @typedef {Object} MentionResult
 * @property {string} cleanedInput - input bez @mentions
 * @property {string} context - kontekst do dodania do wiadomości
 * @property {Mention[]} mentions - lista znalezionych mentions
 */

// Regex do znajdowania @mentions
// Obsługuje: @plik.js, @folder/plik.js, @"ścieżka ze spacjami", @./względna
const MENTION_REGEX = /@(?:"([^"]+)"|'([^']+)'|(\S+))/g;

/**
 * Parsuje input użytkownika i znajduje @mentions.
 * @param {string} input - input użytkownika
 * @returns {Array<{match: string, path: string, start: number, end: number}>}
 */
export function findMentions(input) {
  const mentions = [];
  let match;

  // Reset regex
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(input)) !== null) {
    // Wyciągnij ścieżkę z różnych grup (cudzysłów podwójny, pojedynczy, bez cudzysłowów)
    const path = match[1] || match[2] || match[3];

    // Pomiń @mentions które wyglądają jak email lub Twitter handle
    if (path.includes('@') || path.match(/^[a-zA-Z]+$/)) {
      continue;
    }

    mentions.push({
      match: match[0],
      path: path,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Sprawdza czy ścieżka istnieje i czy to plik czy folder.
 * @param {string} path
 * @returns {Promise<'file'|'directory'|'notfound'>}
 */
async function checkPathType(path) {
  try {
    const stats = await fs.stat(path);
    return stats.isDirectory() ? 'directory' : 'file';
  } catch {
    return 'notfound';
  }
}

/**
 * Czyta zawartość pliku z limitem rozmiaru.
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
async function readFileContent(filePath) {
  try {
    const stats = await fs.stat(filePath);

    if (stats.size > CONFIG.ANALYZER_MAX_FILE_SIZE) {
      return `[Plik zbyt duży: ${(stats.size / 1024).toFixed(1)} KB > ${CONFIG.ANALYZER_MAX_FILE_SIZE / 1024} KB limit]`;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (err) {
    return `[Błąd odczytu: ${err.message}]`;
  }
}

/**
 * Listuje zawartość folderu (płytko).
 * @param {string} dirPath
 * @returns {Promise<string>}
 */
async function listDirectoryContent(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const lines = [];

    for (const entry of entries.slice(0, 50)) { // Limit do 50 wpisów
      const icon = entry.isDirectory() ? '📁' : '📄';
      lines.push(`${icon} ${entry.name}`);
    }

    if (entries.length > 50) {
      lines.push(`... i ${entries.length - 50} więcej`);
    }

    return lines.join('\n');
  } catch (err) {
    return `[Błąd odczytu katalogu: ${err.message}]`;
  }
}

/**
 * Przetwarza @mentions w input użytkownika.
 * Zwraca oczyszczony input i kontekst plików.
 *
 * @param {string} input - input użytkownika
 * @param {string} [basePath=process.cwd()] - bazowa ścieżka dla względnych ścieżek
 * @returns {Promise<MentionResult>}
 */
export async function processMentions(input, basePath = process.cwd()) {
  const rawMentions = findMentions(input);

  if (rawMentions.length === 0) {
    return { cleanedInput: input, context: '', mentions: [] };
  }

  const mentions = [];
  const contextParts = [];

  // Przetwórz każdą mention
  for (const raw of rawMentions) {
    // Rozwiąż ścieżkę względem basePath
    const resolvedPath = resolve(basePath, raw.path);
    const type = await checkPathType(resolvedPath);

    mentions.push({
      original: raw.match,
      path: resolvedPath,
      type,
    });

    if (type === 'file') {
      const ext = extname(resolvedPath).toLowerCase();
      const content = await readFileContent(resolvedPath);
      const relPath = relative(basePath, resolvedPath);

      contextParts.push(`\n### 📄 Plik: ${relPath}\n\`\`\`${ext.slice(1) || 'text'}\n${content}\n\`\`\``);
      console.log(chalk.green(`  ✓ Załadowano: ${relPath}`));

    } else if (type === 'directory') {
      const content = await listDirectoryContent(resolvedPath);
      const relPath = relative(basePath, resolvedPath) || '.';

      contextParts.push(`\n### 📁 Folder: ${relPath}\n${content}`);
      console.log(chalk.green(`  ✓ Załadowano listę: ${relPath}/`));

    } else {
      console.log(chalk.yellow(`  ⚠ Nie znaleziono: ${raw.path}`));
    }
  }

  // Usuń @mentions z inputu
  let cleanedInput = input;
  // Sortuj od końca żeby indeksy się nie przesuwały
  const sortedMentions = [...rawMentions].sort((a, b) => b.start - a.start);
  for (const m of sortedMentions) {
    cleanedInput = cleanedInput.slice(0, m.start) + cleanedInput.slice(m.end);
  }

  // Cleanup - usuń podwójne spacje
  cleanedInput = cleanedInput.replace(/\s+/g, ' ').trim();

  const context = contextParts.length > 0
    ? `\n\n[KONTEKST PLIKÓW - użytkownik wskazał te pliki/foldery]\n${contextParts.join('\n')}\n[KONIEC KONTEKSTU PLIKÓW]\n\n`
    : '';

  return { cleanedInput, context, mentions };
}

/**
 * Wyświetla pomoc o @mentions.
 */
export function showMentionsHelp() {
  console.log(chalk.cyan('\n📎 Użycie @mentions:\n'));
  console.log(chalk.gray('  @plik.js           - załaduj pojedynczy plik'));
  console.log(chalk.gray('  @src/utils.js      - załaduj plik ze ścieżką'));
  console.log(chalk.gray('  @src/              - załaduj listę plików w folderze'));
  console.log(chalk.gray('  @"plik ze spacją"  - ścieżka ze spacjami'));
  console.log(chalk.gray('  @./relative        - ścieżka względna\n'));
  console.log(chalk.gray('Przykład: "Popraw błąd w @src/utils.js"\n'));
}
