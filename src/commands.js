// commands.js - Dispatcher komend

import chalk from 'chalk';
import { CONFIG } from './config.js';
import { saveConversation, loadConversation, listConversations } from './history.js';
import { analyzeProject, buildFileTree, buildProjectContext, quickScanProject, buildQuickContext } from './analyzer.js';
import { handleGitCommand } from './git.js';
import { handleWebCommand } from './web.js';
import { handleSnippetCommand } from './snippets.js';
import { handleMemoryCommand, loadMemory, buildMemoryContext } from './memory.js';
import { handleTestCommand } from './test-runner.js';
import { handleConfigCommand } from './config-editor.js';
import { logger, LOG_LEVELS, LEVEL_NAMES } from './logger.js';

const COMMANDS = {
  '/help':    'Wyświetl pełną pomoc',
  '/exit':    'Zapisz rozmowę i wyjdź',
  '/clear':   'Wyczyść historię i kontekst projektu',
  '/info':    'Wyświetl konfigurację',
  '/save':    'Ręcznie zapisz rozmowę',
  '/history': 'Lista zapisanych rozmów',
  '/load':    'Wczytaj rozmowę — /load <id>',
  '/analyze': 'Analizuj projekt — /analyze [ścieżka]',
  '/autorun': 'Przełącz auto-wykonywanie komend',
  '/git':     'Komendy Git — /git status|diff|commit|log|branch',
  '/web':     'Pobierz dokumentację — /web <URL>',
  '/snippet': 'Snippety kodu — /snippet list|save|use|delete',
  '/memory':  'Pamięć AI — /memory show|set|note|clear',
  '/test':    'Uruchom testy — /test [komenda]',
  '/config':  'Konfiguracja — /config show|set|reset',
  '/debug':   'Debugowanie — /debug [off|error|warn|info|debug|trace]',
  '/context': 'Pokaż/odśwież kontekst projektu — /context [rescan]',
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
 * @returns {Promise<{action: string, data?: any, context?: string}>}
 */
export async function handleCommand(input, state) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const subCmd = parts[1]?.toLowerCase() || '';
  const args = parts.slice(2).join(' ');
  const fullArgs = parts.slice(1).join(' ');

  switch (cmd) {
    case '/help':
      return cmdHelp();
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
      return await cmdLoad(fullArgs, state);
    case '/analyze':
      return await cmdAnalyze(fullArgs, state);
    case '/autorun':
      return cmdAutorun(state);
    case '/git':
      await handleGitCommand(subCmd, args);
      return { action: 'continue' };
    case '/web':
      const webContext = await handleWebCommand(fullArgs);
      if (webContext) {
        state.webContext = webContext;
        console.log(chalk.green('✔ Dokumentacja załadowana do kontekstu\n'));
      }
      return { action: 'continue', context: webContext };
    case '/snippet':
      const snippetCode = await handleSnippetCommand(subCmd, args);
      return { action: 'continue', context: snippetCode };
    case '/memory':
      await handleMemoryCommand(subCmd, args);
      return { action: 'continue' };
    case '/test':
      await handleTestCommand(fullArgs);
      return { action: 'continue' };
    case '/config':
      await handleConfigCommand(subCmd, args);
      return { action: 'continue' };
    case '/debug':
      return cmdDebug(subCmd, args);
    case '/context':
      return await cmdContext(subCmd, state);
    default:
      return cmdUnknown(cmd);
  }
}

function cmdHelp() {
  console.log(chalk.magenta.bold('\n╔═══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.magenta.bold('║                    📚 AI Coding CLI - Pomoc                           ║'));
  console.log(chalk.magenta.bold('╚═══════════════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.cyan.bold('📌 KOMENDY:'));
  for (const [name, desc] of Object.entries(COMMANDS)) {
    console.log(chalk.white(`  ${name.padEnd(12)}`) + chalk.gray(desc));
  }

  console.log(chalk.cyan.bold('\n📎 @MENTIONS - WSKAZYWANIE PLIKÓW:'));
  console.log(chalk.gray('  Użyj @ aby wskazać plik lub folder który ma być uwzględniony w kontekście:\n'));
  console.log(chalk.white('  @plik.js           ') + chalk.gray('- załaduj pojedynczy plik'));
  console.log(chalk.white('  @src/utils.js      ') + chalk.gray('- załaduj plik ze ścieżką'));
  console.log(chalk.white('  @src/              ') + chalk.gray('- załaduj listę plików w folderze'));
  console.log(chalk.white('  @"plik ze spacją"  ') + chalk.gray('- ścieżka ze spacjami'));
  console.log(chalk.gray('\n  Przykład: "Popraw błąd w @src/utils.js i zaktualizuj @tests/"'));

  console.log(chalk.cyan.bold('\n⌨️  SKRÓTY KLAWISZOWE:'));
  console.log(chalk.white('  ↑/↓              ') + chalk.gray('- przeglądaj historię komend'));
  console.log(chalk.white('  Tab              ') + chalk.gray('- autouzupełnianie (komendy, pliki)'));
  console.log(chalk.white('  Ctrl+C           ') + chalk.gray('- przerwij generowanie'));
  console.log(chalk.white('  \\                ') + chalk.gray('- kontynuuj w następnej linii (multiline)'));

  console.log(chalk.cyan.bold('\n⚡ AUTO-EXECUTE:'));
  console.log(chalk.gray('  /autorun włącza automatyczne wykonywanie bezpiecznych komend.'));
  console.log(chalk.gray('  Niebezpieczne komendy zawsze wymagają potwierdzenia.'));

  console.log(chalk.cyan.bold('\n📊 ANALIZA PROJEKTU:'));
  console.log(chalk.gray('  /analyze skanuje projekt i daje AI pełny kontekst:'));
  console.log(chalk.gray('  strukturę plików, zależności, główne moduły.\n'));

  console.log(chalk.cyan.bold('🔍 DEBUGOWANIE:'));
  console.log(chalk.gray('  /debug info     - włącz podstawowe logi'));
  console.log(chalk.gray('  /debug debug    - włącz szczegółowe logi'));
  console.log(chalk.gray('  /debug trace    - włącz wszystkie logi (bardzo szczegółowy)'));
  console.log(chalk.gray('  /debug off      - wyłącz logowanie'));
  console.log(chalk.gray('  /debug file on  - zapisuj logi do pliku\n'));
  console.log(chalk.gray('  Zmienne środowiskowe:'));
  console.log(chalk.gray('    AI_CLI_LOG_LEVEL=debug  - ustaw poziom przy starcie'));
  console.log(chalk.gray('    AI_CLI_LOG_FILE=true    - włącz zapis do pliku\n'));

  console.log(chalk.cyan.bold('💡 WSKAZÓWKI:'));
  console.log(chalk.gray('  • Używaj @plik.js zamiast /analyze dla szybszego kontekstu'));
  console.log(chalk.gray('  • Model automatycznie naprawia błędy w komendach (max 3 próby)'));
  console.log(chalk.gray('  • /git status - szybki podgląd zmian'));
  console.log(chalk.gray('  • /test - uruchom testy jedną komendą'));
  console.log(chalk.gray('  • Zmiany w kodzie są wyświetlane w formacie diff (zielony/czerwony)\n'));

  return { action: 'continue' };
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
  state.webContext = null;
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
  if (state.webContext) {
    console.log(chalk.cyan(`   Dokumentacja web: załadowana`));
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
  console.log(chalk.gray('Użyj /help aby zobaczyć dostępne komendy\n'));
  return { action: 'continue' };
}

async function cmdContext(action, state) {
  const cwd = process.cwd();

  if (action === 'rescan' || action === 'refresh' || action === 'reload') {
    console.log(chalk.cyan(`\n🔄 Skanowanie struktury projektu: ${cwd}...\n`));

    try {
      const quickScan = await quickScanProject(cwd, 3);
      state.quickContext = buildQuickContext(quickScan);

      console.log(chalk.green(`✔ Załadowano strukturę projektu:`));
      console.log(chalk.gray(`   Plików: ${quickScan.files.length}`));
      console.log(chalk.gray(`   Katalogów: ${quickScan.dirs.length}`));

      if (quickScan.packageJson) {
        console.log(chalk.gray(`   Projekt: ${quickScan.packageJson.name || 'nieznany'}`));
      }

      console.log(chalk.gray(`\n${buildFileTree(quickScan.files)}\n`));
    } catch (err) {
      console.log(chalk.red(`\n✖ Błąd skanowania: ${err.message}\n`));
    }

    return { action: 'continue' };
  }

  // Pokaż aktualny kontekst
  console.log(chalk.cyan('\n📁 Kontekst projektu:'));
  console.log(chalk.cyan(`   Lokalizacja: ${cwd}`));

  if (state.quickContext) {
    console.log(chalk.green('   Struktura: ✔ załadowana'));
  } else {
    console.log(chalk.yellow('   Struktura: ✖ brak (użyj /context rescan)'));
  }

  if (state.projectContext) {
    console.log(chalk.green('   Pełna analiza: ✔ załadowana (przez /analyze)'));
  } else {
    console.log(chalk.gray('   Pełna analiza: ✖ brak (użyj /analyze dla pełnej zawartości)'));
  }

  if (state.webContext) {
    console.log(chalk.green('   Dokumentacja web: ✔ załadowana'));
  }

  console.log();
  console.log(chalk.gray('Użycie:'));
  console.log(chalk.gray('  /context         - pokaż status'));
  console.log(chalk.gray('  /context rescan  - odśwież strukturę projektu'));
  console.log(chalk.gray('  /analyze         - pełna analiza z zawartością plików'));
  console.log(chalk.gray('  @plik.js         - załaduj konkretny plik do kontekstu\n'));

  return { action: 'continue' };
}

function cmdDebug(level, args) {
  // Bez argumentów - pokaż status
  if (!level) {
    logger.status();
    console.log(chalk.cyan('Użycie:'));
    console.log(chalk.gray('  /debug off          - wyłącz logowanie'));
    console.log(chalk.gray('  /debug error        - tylko błędy'));
    console.log(chalk.gray('  /debug warn         - błędy + ostrzeżenia'));
    console.log(chalk.gray('  /debug info         - + informacje'));
    console.log(chalk.gray('  /debug debug        - + szczegóły debugowania'));
    console.log(chalk.gray('  /debug trace        - wszystko (bardzo szczegółowy)'));
    console.log(chalk.gray('  /debug file on|off  - włącz/wyłącz zapis do pliku'));
    console.log();
    return { action: 'continue' };
  }

  // Obsługa zapisu do pliku
  if (level === 'file') {
    const enabled = args === 'on' || args === 'true' || args === '1';
    logger.setFileLogging(enabled);
    console.log(chalk.cyan(`\n📋 Zapis do pliku: ${enabled ? 'WŁĄCZONY' : 'WYŁĄCZONY'}\n`));
    return { action: 'continue' };
  }

  // Ustaw poziom logowania
  const upperLevel = level.toUpperCase();
  if (logger.setLevel(upperLevel)) {
    const color = upperLevel === 'OFF' ? chalk.yellow : chalk.green;
    console.log(color(`\n📋 Poziom logowania: ${upperLevel}\n`));

    if (upperLevel !== 'OFF') {
      console.log(chalk.gray('Logi będą wyświetlane w trakcie działania aplikacji.'));
      console.log(chalk.gray('Użyj /debug off aby wyłączyć.\n'));
    }
  } else {
    console.log(chalk.yellow(`\n⚠ Nieznany poziom: ${level}`));
    console.log(chalk.gray('Dostępne: off, error, warn, info, debug, trace\n'));
  }

  return { action: 'continue' };
}
