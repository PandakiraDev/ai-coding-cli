// input.js - Zaawansowany input z historią, tab completion i przerwaniem

import readline from 'readline';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

// Ścieżka do pliku historii komend
const HISTORY_FILE = join(homedir(), '.ai-coding-cli', 'input-history.json');
const MAX_HISTORY = 100;

// Globalna historia komend (ładowana przy starcie)
let commandHistory = [];
let historyIndex = -1;

/**
 * Ładuje historię komend z pliku.
 */
export async function loadCommandHistory() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    commandHistory = JSON.parse(data).slice(-MAX_HISTORY);
  } catch {
    commandHistory = [];
  }
}

/**
 * Zapisuje historię komend do pliku.
 */
export async function saveCommandHistory() {
  try {
    const dir = dirname(HISTORY_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(HISTORY_FILE, JSON.stringify(commandHistory.slice(-MAX_HISTORY)));
  } catch {
    // Ignoruj błędy zapisu
  }
}

/**
 * Dodaje komendę do historii.
 */
function addToHistory(cmd) {
  if (cmd.trim() && cmd !== commandHistory[commandHistory.length - 1]) {
    commandHistory.push(cmd);
    if (commandHistory.length > MAX_HISTORY) {
      commandHistory.shift();
    }
  }
  historyIndex = commandHistory.length;
}

/**
 * Pobiera listę plików do tab completion.
 */
async function getFileCompletions(partial) {
  try {
    const dir = partial.includes('/') || partial.includes('\\')
      ? dirname(partial)
      : '.';
    const prefix = basename(partial).toLowerCase();

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const matches = entries
      .filter(e => e.name.toLowerCase().startsWith(prefix))
      .map(e => {
        const name = dir === '.' ? e.name : join(dir, e.name);
        return e.isDirectory() ? name + '/' : name;
      });

    return matches;
  } catch {
    return [];
  }
}

/**
 * Komendy dostępne do autouzupełnienia.
 */
const COMMANDS = [
  '/help', '/exit', '/clear', '/info', '/save', '/history',
  '/load', '/analyze', '/autorun', '/git', '/web', '/snippet',
  '/test', '/config', '/undo'
];

/**
 * Czyta input użytkownika z obsługą:
 * - Historia komend (strzałki góra/dół)
 * - Tab completion (pliki, komendy)
 * - Multiline (backslash)
 * - Przerwanie (Ctrl+C)
 *
 * @param {string} promptMessage - komunikat prompta
 * @param {string} [prefix=''] - prefix przed promptem
 * @returns {Promise<string>} - pełny input
 */
export async function readInput(promptMessage, prefix = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: MAX_HISTORY,
      completer: async (line, callback) => {
        // Tab completion
        const completions = await getCompletions(line);
        callback(null, [completions, line]);
      },
    });

    // Załaduj historię do readline
    rl.history = [...commandHistory].reverse();

    const fullPrompt = prefix ? `${prefix} ${promptMessage} ` : `${promptMessage} `;
    const lines = [];
    let currentLine = '';
    let isMultiline = false;

    const askLine = (prompt) => {
      rl.question(prompt, (answer) => {
        if (answer === null || answer === undefined) {
          // Ctrl+C lub zamknięcie
          rl.close();
          resolve('');
          return;
        }

        if (answer.endsWith('\\')) {
          // Kontynuacja wieloliniowa
          lines.push(answer.slice(0, -1));
          isMultiline = true;
          askLine(chalk.gray('... '));
        } else {
          lines.push(answer);
          const fullInput = lines.join('\n');

          // Dodaj do historii (nie dodawaj pustych ani powtórzeń)
          if (fullInput.trim()) {
            addToHistory(fullInput);
          }

          rl.close();
          resolve(fullInput);
        }
      });
    };

    // Obsługa Ctrl+C
    rl.on('SIGINT', () => {
      console.log(chalk.yellow('\n^C'));
      rl.close();
      resolve('');
    });

    // Obsługa zamknięcia
    rl.on('close', () => {
      if (lines.length === 0) {
        resolve('');
      }
    });

    askLine(fullPrompt);
  });
}

/**
 * Pobiera możliwe uzupełnienia dla danego inputu.
 */
async function getCompletions(line) {
  const trimmed = line.trimStart();

  // Uzupełnianie komend
  if (trimmed.startsWith('/')) {
    const matches = COMMANDS.filter(c => c.startsWith(trimmed));
    return matches.length > 0 ? matches : COMMANDS;
  }

  // Uzupełnianie @mentions (pliki)
  const atMatch = trimmed.match(/@(\S*)$/);
  if (atMatch) {
    const partial = atMatch[1];
    const files = await getFileCompletions(partial);
    return files.map(f => line.slice(0, -partial.length) + f);
  }

  // Brak uzupełnienia
  return [];
}

/**
 * Czyta potwierdzenie (y/n) od użytkownika.
 * @param {string} message - pytanie
 * @param {boolean} [defaultValue=false] - domyślna wartość
 * @returns {Promise<boolean>}
 */
export async function readConfirm(message, defaultValue = false) {
  const hint = defaultValue ? '[Y/n]' : '[y/N]';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} ${hint} `, (answer) => {
      rl.close();
      const lower = answer.toLowerCase().trim();
      if (lower === '') {
        resolve(defaultValue);
      } else {
        resolve(lower === 'y' || lower === 'yes' || lower === 'tak' || lower === 't');
      }
    });

    rl.on('SIGINT', () => {
      rl.close();
      resolve(false);
    });
  });
}

/**
 * Czyta wybór z listy opcji.
 * @param {string} message - pytanie
 * @param {string[]} options - opcje do wyboru
 * @returns {Promise<number>} - indeks wybranej opcji (-1 jeśli anulowano)
 */
export async function readChoice(message, options) {
  console.log(chalk.cyan(message));
  options.forEach((opt, i) => {
    console.log(chalk.white(`  ${i + 1}. ${opt}`));
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.gray('Wybierz (1-' + options.length + '): '), (answer) => {
      rl.close();
      const num = parseInt(answer, 10);
      if (num >= 1 && num <= options.length) {
        resolve(num - 1);
      } else {
        resolve(-1);
      }
    });

    rl.on('SIGINT', () => {
      rl.close();
      resolve(-1);
    });
  });
}
