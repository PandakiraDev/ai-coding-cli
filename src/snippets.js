// snippets.js - System zapisywania i używania snippetów kodu

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const SNIPPETS_FILE = join(homedir(), '.ai-coding-cli', 'snippets.json');

let snippets = {};

/**
 * Ładuje snippety z pliku.
 */
export async function loadSnippets() {
  try {
    const data = await fs.readFile(SNIPPETS_FILE, 'utf-8');
    snippets = JSON.parse(data);
  } catch {
    snippets = {};
  }
}

/**
 * Zapisuje snippety do pliku.
 */
async function saveSnippets() {
  try {
    const dir = dirname(SNIPPETS_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(SNIPPETS_FILE, JSON.stringify(snippets, null, 2));
  } catch (err) {
    console.log(chalk.red(`✖ Błąd zapisu snippetów: ${err.message}`));
  }
}

/**
 * Zapisuje nowy snippet.
 * @param {string} name - nazwa snippetu
 * @param {string} code - kod do zapisania
 * @param {string} [language='text'] - język kodu
 */
export async function saveSnippet(name, code, language = 'text') {
  if (!name) {
    console.log(chalk.yellow('\n⚠ Podaj nazwę snippetu\n'));
    return;
  }

  if (!code) {
    console.log(chalk.yellow('\n⚠ Podaj kod do zapisania\n'));
    return;
  }

  snippets[name] = {
    code,
    language,
    createdAt: new Date().toISOString(),
  };

  await saveSnippets();
  console.log(chalk.green(`\n✔ Snippet "${name}" zapisany\n`));
}

/**
 * Pobiera snippet.
 * @param {string} name - nazwa snippetu
 * @returns {Object|null}
 */
export function getSnippet(name) {
  return snippets[name] || null;
}

/**
 * Usuwa snippet.
 * @param {string} name - nazwa snippetu
 */
export async function deleteSnippet(name) {
  if (!snippets[name]) {
    console.log(chalk.yellow(`\n⚠ Snippet "${name}" nie istnieje\n`));
    return;
  }

  delete snippets[name];
  await saveSnippets();
  console.log(chalk.green(`\n✔ Snippet "${name}" usunięty\n`));
}

/**
 * Wyświetla listę snippetów.
 */
export function listSnippets() {
  const names = Object.keys(snippets);

  if (names.length === 0) {
    console.log(chalk.gray('\nBrak zapisanych snippetów.\n'));
    console.log(chalk.gray('Użyj /snippet save <nazwa> <kod> aby zapisać.\n'));
    return;
  }

  console.log(chalk.cyan(`\n📋 Snippety (${names.length}):\n`));

  for (const name of names) {
    const s = snippets[name];
    const preview = s.code.substring(0, 50).replace(/\n/g, ' ');
    console.log(chalk.white(`  ${name}`) + chalk.gray(` [${s.language}]`));
    console.log(chalk.gray(`    ${preview}${s.code.length > 50 ? '...' : ''}`));
  }

  console.log(chalk.gray('\n  Użyj /snippet use <nazwa> aby wstawić snippet\n'));
}

/**
 * Wyświetla snippet.
 * @param {string} name - nazwa snippetu
 */
export function showSnippet(name) {
  const s = snippets[name];

  if (!s) {
    console.log(chalk.yellow(`\n⚠ Snippet "${name}" nie istnieje\n`));
    return;
  }

  console.log(chalk.cyan(`\n📄 Snippet: ${name}\n`));
  console.log(chalk.gray(`Język: ${s.language}`));
  console.log(chalk.gray(`Utworzono: ${new Date(s.createdAt).toLocaleString('pl-PL')}\n`));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(s.code);
  console.log(chalk.gray('─'.repeat(60)));
  console.log();
}

/**
 * Obsługuje komendę /snippet.
 * @param {string} action - akcja (save, use, delete, list, show)
 * @param {string} args - argumenty
 * @returns {Promise<string|null>} - kod snippetu do wstawienia lub null
 */
export async function handleSnippetCommand(action, args) {
  // Załaduj snippety przy pierwszym użyciu
  if (Object.keys(snippets).length === 0) {
    await loadSnippets();
  }

  const parts = args ? args.split(/\s+/) : [];
  const name = parts[0];
  const rest = parts.slice(1).join(' ');

  switch (action) {
    case 'save':
    case 's':
      if (!name || !rest) {
        console.log(chalk.cyan('\n💾 Użycie: /snippet save <nazwa> <kod>\n'));
        console.log(chalk.gray('  Przykład: /snippet save hello console.log("Hello!")\n'));
        return null;
      }
      // Wykryj język z kodu
      let lang = 'text';
      if (rest.includes('function') || rest.includes('const ') || rest.includes('=>')) lang = 'javascript';
      else if (rest.includes('def ') || rest.includes('import ')) lang = 'python';
      else if (rest.includes('Get-') || rest.includes('$')) lang = 'powershell';

      await saveSnippet(name, rest, lang);
      return null;

    case 'use':
    case 'u':
      if (!name) {
        console.log(chalk.yellow('\n⚠ Podaj nazwę snippetu: /snippet use <nazwa>\n'));
        return null;
      }
      const snippet = getSnippet(name);
      if (!snippet) {
        console.log(chalk.yellow(`\n⚠ Snippet "${name}" nie istnieje\n`));
        return null;
      }
      console.log(chalk.green(`\n✔ Wstawiam snippet "${name}":\n`));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(snippet.code);
      console.log(chalk.gray('─'.repeat(40)));
      console.log();
      return `[SNIPPET: ${name}]\n\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`\n`;

    case 'delete':
    case 'd':
      await deleteSnippet(name);
      return null;

    case 'show':
      showSnippet(name);
      return null;

    case 'list':
    case 'l':
    default:
      listSnippets();
      return null;
  }
}
