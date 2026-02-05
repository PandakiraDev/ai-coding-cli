// commands.js - Dispatcher komend /exit, /clear, /save, /load, /history, /analyze, /info

import chalk from 'chalk';
import { CONFIG } from './config.js';
import { saveConversation, loadConversation, listConversations } from './history.js';
import { analyzeProject, buildFileTree, buildProjectContext } from './analyzer.js';

const COMMANDS = {
  '/exit':    'Zapisz rozmowę i wyjdź',
  '/clear':   'Wyczyść historię i kontekst projektu',
  '/info':    'Wyświetl konfigurację',
  '/save':    'Ręcznie zapisz rozmowę',
  '/history': 'Lista zapisanych rozmów',
  '/load':    'Wczytaj rozmowę — /load <id>',
  '/analyze': 'Analizuj projekt — /analyze [ścieżka]',
  '/autorun': 'Przełącz auto-wykonywanie komend',
};

/**
 * Sprawdza czy tekst jest komendą (zaczyna się od /).
 */
export function isCommand(text) {
  return text.startsWith('/');
}

/**
 * Obsługuje komendy. Zwraca obiekt opisujący wynik.
 *
 * @param {string} input
 * @param {object} state - { conversation, projectContext }
 * @returns {Promise<{action: string, data?: any}>}
 *   action: 'continue' | 'exit' | 'cleared' | 'loaded' | 'unknown'
 */
export async function handleCommand(input, state) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ');

  switch (cmd) {
    case '/exit':
      return await cmdExit(state);
    case '/clear':
      return cmdClear(state);
    case '/info':
      return cmdInfo(state);
    case '/save':
      return await cmdSave(state);
    case '/history':
      return await cmdHistory();
    case '/load':
      return await cmdLoad(arg, state);
    case '/analyze':
      return await cmdAnalyze(arg, state);
    case '/autorun':
      return cmdAutorun(state);
    default:
      return cmdUnknown(cmd);
  }
}

async function cmdExit(state) {
  if (state.conversation.messages.length > 0) {
    try {
      await saveConversation(state.conversation);
      console.log(chalk.green(`\n✔ Rozmowa zapisana (ID: ${state.conversation.id})`));
    } catch (err) {
      console.log(chalk.yellow(`\n⚠ Nie udało się zapisać rozmowy: ${err.message}`));
    }
  }
  console.log(chalk.yellow('\n👋 Do zobaczenia!\n'));
  return { action: 'exit' };
}

function cmdClear(state) {
  state.conversation.messages.length = 0;
  state.projectContext = null;
  console.log(chalk.yellow('\n🗑️  Historia i kontekst wyczyszczone\n'));
  return { action: 'cleared' };
}

function cmdInfo(state) {
  console.log(chalk.cyan('\n📊 Konfiguracja:'));
  console.log(chalk.cyan(`   Model: ${CONFIG.MODEL_NAME}`));
  console.log(chalk.cyan(`   Host: ${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}`));
  console.log(chalk.cyan(`   Tryb demo: ${CONFIG.DEMO_MODE}`));
  console.log(chalk.cyan(`   Historia: ${state.conversation.messages.length} wiadomości`));
  console.log(chalk.cyan(`   Sliding window: ${CONFIG.MAX_HISTORY_MESSAGES}`));
  console.log(chalk.cyan(`   ID rozmowy: ${state.conversation.id}`));
  console.log(chalk.cyan(`   Auto-execute: ${state.autoExecute ? 'WŁĄCZONY' : 'WYŁĄCZONY'}`));
  if (state.projectContext) {
    console.log(chalk.cyan(`   Projekt: załadowany`));
  }
  console.log();
  return { action: 'continue' };
}

async function cmdSave(state) {
  try {
    await saveConversation(state.conversation);
    console.log(chalk.green(`\n✔ Rozmowa zapisana (ID: ${state.conversation.id})\n`));
  } catch (err) {
    console.log(chalk.red(`\n✖ Błąd zapisu: ${err.message}\n`));
  }
  return { action: 'continue' };
}

async function cmdHistory() {
  const conversations = await listConversations();

  if (conversations.length === 0) {
    console.log(chalk.gray('\nBrak zapisanych rozmów.\n'));
    return { action: 'continue' };
  }

  console.log(chalk.cyan(`\n📂 Zapisane rozmowy (${conversations.length}):\n`));
  for (const c of conversations) {
    const date = new Date(c.updatedAt).toLocaleString('pl-PL');
    console.log(chalk.white(`  ${c.id}`) + chalk.gray(` | ${date} | ${c.messageCount} wiad. | ${c.preview}`));
  }
  console.log(chalk.gray('\n  Użyj /load <id> aby wczytać rozmowę\n'));
  return { action: 'continue' };
}

async function cmdLoad(id, state) {
  if (!id) {
    console.log(chalk.yellow('\n⚠ Podaj ID rozmowy: /load <id>\n'));
    return { action: 'continue' };
  }

  try {
    const loaded = await loadConversation(id);
    state.conversation.id = loaded.id;
    state.conversation.createdAt = loaded.createdAt;
    state.conversation.updatedAt = loaded.updatedAt;
    state.conversation.model = loaded.model;
    state.conversation.messages.length = 0;
    state.conversation.messages.push(...loaded.messages);

    console.log(chalk.green(`\n✔ Wczytano rozmowę: ${loaded.id} (${loaded.messages.length} wiadomości)\n`));
    return { action: 'loaded' };
  } catch (err) {
    console.log(chalk.red(`\n✖ Nie udało się wczytać rozmowy: ${err.message}\n`));
    return { action: 'continue' };
  }
}

async function cmdAnalyze(pathArg, state) {
  const targetPath = pathArg || process.cwd();

  console.log(chalk.cyan(`\n🔍 Analizuję projekt: ${targetPath}...\n`));

  try {
    const analysis = await analyzeProject(targetPath);

    console.log(chalk.green(`✔ Znaleziono ${analysis.files.length} plików (${(analysis.totalSize / 1024).toFixed(1)} KB)\n`));
    console.log(chalk.gray(buildFileTree(analysis.files)));
    console.log();

    if (analysis.skipped.length > 0) {
      console.log(chalk.yellow(`⚠ Pominięto ${analysis.skipped.length} elementów`));
      for (const reason of analysis.skipped.slice(0, 5)) {
        console.log(chalk.gray(`  - ${reason}`));
      }
      if (analysis.skipped.length > 5) {
        console.log(chalk.gray(`  ... i ${analysis.skipped.length - 5} więcej`));
      }
      console.log();
    }

    state.projectContext = buildProjectContext(analysis);
    console.log(chalk.green('✔ Kontekst projektu załadowany — AI będzie uwzględniać go w odpowiedziach\n'));

    return { action: 'continue' };
  } catch (err) {
    console.log(chalk.red(`\n✖ Błąd analizy: ${err.message}\n`));
    return { action: 'continue' };
  }
}

function cmdAutorun(state) {
  state.autoExecute = !state.autoExecute;
  const status = state.autoExecute ? 'WŁĄCZONY' : 'WYŁĄCZONY';
  const color = state.autoExecute ? chalk.green : chalk.yellow;
  console.log(color(`\n⚡ Auto-execute: ${status}\n`));
  return { action: 'continue' };
}

function cmdUnknown(cmd) {
  console.log(chalk.yellow(`\n⚠ Nieznana komenda: ${cmd}`));
  console.log(chalk.gray('Dostępne komendy:'));
  for (const [name, desc] of Object.entries(COMMANDS)) {
    console.log(chalk.gray(`  ${name.padEnd(12)} ${desc}`));
  }
  console.log();
  return { action: 'continue' };
}
