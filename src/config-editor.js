// config-editor.js - Edycja konfiguracji z CLI

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const USER_CONFIG_FILE = join(homedir(), '.ai-coding-cli', 'config.json');

let userConfig = {};

/**
 * Ładuje konfigurację użytkownika.
 */
export async function loadUserConfig() {
  try {
    const data = await fs.readFile(USER_CONFIG_FILE, 'utf-8');
    userConfig = JSON.parse(data);
  } catch {
    userConfig = {};
  }
  return userConfig;
}

/**
 * Zapisuje konfigurację użytkownika.
 */
async function saveUserConfig() {
  try {
    const dir = dirname(USER_CONFIG_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(USER_CONFIG_FILE, JSON.stringify(userConfig, null, 2));
  } catch (err) {
    console.error(chalk.red(`✖ Błąd zapisu konfiguracji: ${err.message}`));
  }
}

/**
 * Dostępne opcje konfiguracji.
 */
const CONFIG_OPTIONS = {
  model: {
    description: 'Nazwa modelu Ollama',
    type: 'string',
    default: 'qwen2.5-coder:32b',
  },
  host: {
    description: 'Host serwera Ollama',
    type: 'string',
    default: 'localhost',
  },
  port: {
    description: 'Port serwera Ollama',
    type: 'number',
    default: 11434,
  },
  timeout: {
    description: 'Timeout requestu (ms)',
    type: 'number',
    default: 300000,
  },
  historySize: {
    description: 'Maksymalna liczba wiadomości w oknie kontekstu',
    type: 'number',
    default: 20,
  },
  demoMode: {
    description: 'Tryb demo (bez serwera)',
    type: 'boolean',
    default: false,
  },
  autoExecute: {
    description: 'Automatyczne wykonywanie bezpiecznych komend',
    type: 'boolean',
    default: false,
  },
};

/**
 * Pobiera wartość konfiguracji.
 * @param {string} key - klucz
 */
export function getConfig(key) {
  if (userConfig[key] !== undefined) {
    return userConfig[key];
  }
  return CONFIG_OPTIONS[key]?.default;
}

/**
 * Ustawia wartość konfiguracji.
 * @param {string} key - klucz
 * @param {string} value - wartość (string, zostanie skonwertowana)
 */
export async function setConfig(key, value) {
  const option = CONFIG_OPTIONS[key];

  if (!option) {
    console.log(chalk.yellow(`\n⚠ Nieznana opcja: ${key}\n`));
    console.log(chalk.gray('Dostępne opcje: ' + Object.keys(CONFIG_OPTIONS).join(', ')));
    return;
  }

  // Konwertuj wartość
  let converted;
  switch (option.type) {
    case 'number':
      converted = parseInt(value, 10);
      if (isNaN(converted)) {
        console.log(chalk.yellow(`\n⚠ Wartość musi być liczbą\n`));
        return;
      }
      break;
    case 'boolean':
      converted = value === 'true' || value === '1' || value === 'yes';
      break;
    default:
      converted = value;
  }

  userConfig[key] = converted;
  await saveUserConfig();
  console.log(chalk.green(`\n✔ Ustawiono ${key} = ${converted}\n`));
}

/**
 * Wyświetla aktualną konfigurację.
 */
export function showConfig() {
  console.log(chalk.cyan('\n⚙️  Konfiguracja:\n'));

  for (const [key, option] of Object.entries(CONFIG_OPTIONS)) {
    const value = getConfig(key);
    const isCustom = userConfig[key] !== undefined;
    const valueStr = isCustom
      ? chalk.green(String(value))
      : chalk.gray(String(value) + ' (domyślna)');

    console.log(chalk.white(`  ${key.padEnd(15)}`), valueStr);
    console.log(chalk.gray(`  ${''.padEnd(15)} ${option.description}\n`));
  }

  console.log(chalk.gray('Plik konfiguracji: ' + USER_CONFIG_FILE + '\n'));
}

/**
 * Resetuje konfigurację do domyślnych.
 */
export async function resetConfig() {
  userConfig = {};
  await saveUserConfig();
  console.log(chalk.green('\n✔ Konfiguracja zresetowana do domyślnych\n'));
}

/**
 * Obsługuje komendę /config.
 * @param {string} action - akcja (show, set, reset)
 * @param {string} args - argumenty
 */
export async function handleConfigCommand(action, args) {
  // Załaduj przy pierwszym użyciu
  if (Object.keys(userConfig).length === 0) {
    await loadUserConfig();
  }

  switch (action) {
    case 'set':
      const [key, ...valueParts] = (args || '').split(/\s+/);
      if (!key || valueParts.length === 0) {
        console.log(chalk.cyan('\n⚙️  Użycie: /config set <klucz> <wartość>\n'));
        console.log(chalk.gray('Dostępne klucze:'));
        for (const [k, opt] of Object.entries(CONFIG_OPTIONS)) {
          console.log(chalk.gray(`  ${k} (${opt.type}) - ${opt.description}`));
        }
        console.log();
        return;
      }
      await setConfig(key, valueParts.join(' '));
      break;

    case 'reset':
      await resetConfig();
      break;

    case 'show':
    default:
      showConfig();
      break;
  }
}
