// memory.js - Pamięć modelu między sesjami

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const MEMORY_FILE = join(homedir(), '.ai-coding-cli', 'memory.json');

let memory = {
  preferences: {},
  projectNotes: {},
  learnedPatterns: [],
  lastSession: null,
};

/**
 * Ładuje pamięć z pliku.
 */
export async function loadMemory() {
  try {
    const data = await fs.readFile(MEMORY_FILE, 'utf-8');
    memory = { ...memory, ...JSON.parse(data) };
  } catch {
    // Użyj domyślnych wartości
  }
  return memory;
}

/**
 * Zapisuje pamięć do pliku.
 */
export async function saveMemory() {
  try {
    const dir = dirname(MEMORY_FILE);
    await fs.mkdir(dir, { recursive: true });
    memory.lastSession = new Date().toISOString();
    await fs.writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2));
  } catch (err) {
    console.error(chalk.red(`✖ Błąd zapisu pamięci: ${err.message}`));
  }
}

/**
 * Ustawia preferencję.
 * @param {string} key - klucz
 * @param {any} value - wartość
 */
export async function setPreference(key, value) {
  memory.preferences[key] = value;
  await saveMemory();
}

/**
 * Pobiera preferencję.
 * @param {string} key - klucz
 * @param {any} [defaultValue] - wartość domyślna
 */
export function getPreference(key, defaultValue = null) {
  return memory.preferences[key] ?? defaultValue;
}

/**
 * Zapisuje notatkę o projekcie.
 * @param {string} projectPath - ścieżka projektu
 * @param {string} note - notatka
 */
export async function addProjectNote(projectPath, note) {
  if (!memory.projectNotes[projectPath]) {
    memory.projectNotes[projectPath] = [];
  }
  memory.projectNotes[projectPath].push({
    note,
    timestamp: new Date().toISOString(),
  });
  await saveMemory();
}

/**
 * Pobiera notatki o projekcie.
 * @param {string} projectPath - ścieżka projektu
 */
export function getProjectNotes(projectPath) {
  return memory.projectNotes[projectPath] || [];
}

/**
 * Dodaje wzorzec nauczony z konwersacji.
 * @param {string} pattern - wzorzec
 */
export async function learnPattern(pattern) {
  if (!memory.learnedPatterns.includes(pattern)) {
    memory.learnedPatterns.push(pattern);
    if (memory.learnedPatterns.length > 50) {
      memory.learnedPatterns.shift();
    }
    await saveMemory();
  }
}

/**
 * Buduje kontekst pamięci do system prompt.
 * @param {string} [projectPath] - opcjonalna ścieżka projektu
 * @returns {string}
 */
export function buildMemoryContext(projectPath) {
  const parts = [];

  // Preferencje użytkownika
  if (Object.keys(memory.preferences).length > 0) {
    parts.push('\n[PREFERENCJE UŻYTKOWNIKA]');
    for (const [key, value] of Object.entries(memory.preferences)) {
      parts.push(`- ${key}: ${value}`);
    }
  }

  // Notatki o projekcie
  if (projectPath && memory.projectNotes[projectPath]?.length > 0) {
    parts.push('\n[NOTATKI O PROJEKCIE]');
    const notes = memory.projectNotes[projectPath].slice(-5);
    for (const n of notes) {
      parts.push(`- ${n.note}`);
    }
  }

  // Nauczone wzorce
  if (memory.learnedPatterns.length > 0) {
    parts.push('\n[NAUCZONE WZORCE]');
    for (const pattern of memory.learnedPatterns.slice(-10)) {
      parts.push(`- ${pattern}`);
    }
  }

  return parts.length > 0 ? parts.join('\n') + '\n' : '';
}

/**
 * Wyświetla aktualną pamięć.
 */
export function showMemory() {
  console.log(chalk.cyan('\n🧠 Pamięć AI:\n'));

  console.log(chalk.white('Preferencje:'));
  if (Object.keys(memory.preferences).length === 0) {
    console.log(chalk.gray('  (brak)\n'));
  } else {
    for (const [key, value] of Object.entries(memory.preferences)) {
      console.log(chalk.gray(`  ${key}: ${value}`));
    }
    console.log();
  }

  console.log(chalk.white('Projekty z notatkami:'));
  const projects = Object.keys(memory.projectNotes);
  if (projects.length === 0) {
    console.log(chalk.gray('  (brak)\n'));
  } else {
    for (const p of projects) {
      console.log(chalk.gray(`  ${p} (${memory.projectNotes[p].length} notatek)`));
    }
    console.log();
  }

  console.log(chalk.white('Nauczone wzorce:'));
  if (memory.learnedPatterns.length === 0) {
    console.log(chalk.gray('  (brak)\n'));
  } else {
    for (const p of memory.learnedPatterns.slice(-5)) {
      console.log(chalk.gray(`  • ${p}`));
    }
    console.log();
  }

  if (memory.lastSession) {
    console.log(chalk.gray(`Ostatnia sesja: ${new Date(memory.lastSession).toLocaleString('pl-PL')}\n`));
  }
}

/**
 * Czyści pamięć.
 */
export async function clearMemory() {
  memory = {
    preferences: {},
    projectNotes: {},
    learnedPatterns: [],
    lastSession: null,
  };
  await saveMemory();
  console.log(chalk.green('\n✔ Pamięć wyczyszczona\n'));
}

/**
 * Obsługuje komendy pamięci.
 * @param {string} action - akcja
 * @param {string} args - argumenty
 */
export async function handleMemoryCommand(action, args) {
  switch (action) {
    case 'show':
    case 's':
      showMemory();
      break;
    case 'clear':
      await clearMemory();
      break;
    case 'set':
      const [key, ...valueParts] = (args || '').split(/\s+/);
      if (!key || valueParts.length === 0) {
        console.log(chalk.yellow('\n⚠ Użycie: /memory set <klucz> <wartość>\n'));
        return;
      }
      await setPreference(key, valueParts.join(' '));
      console.log(chalk.green(`\n✔ Preferencja "${key}" zapisana\n`));
      break;
    case 'note':
      if (!args) {
        console.log(chalk.yellow('\n⚠ Użycie: /memory note <notatka>\n'));
        return;
      }
      await addProjectNote(process.cwd(), args);
      console.log(chalk.green('\n✔ Notatka zapisana\n'));
      break;
    default:
      console.log(chalk.cyan('\n🧠 Komendy pamięci:\n'));
      console.log(chalk.white('  /memory show    ') + chalk.gray('- pokaż pamięć'));
      console.log(chalk.white('  /memory set     ') + chalk.gray('- ustaw preferencję'));
      console.log(chalk.white('  /memory note    ') + chalk.gray('- dodaj notatkę o projekcie'));
      console.log(chalk.white('  /memory clear   ') + chalk.gray('- wyczyść pamięć\n'));
      break;
  }
}
