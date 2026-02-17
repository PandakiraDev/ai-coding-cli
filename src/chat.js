// chat.js - Główna pętla konwersacji

import chalk from 'chalk';
import inquirer from 'inquirer';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { CONFIG } from './config.js';
import { validateInput } from './validator.js';
import {
  createConversation,
  saveConversation,
  buildMessageWindow,
  startAutoSave,
  stopAutoSave,
} from './history.js';
import { streamOllama, streamDemo } from './ollama.js';
import { handlePowerShellCommands, formatResultsForFeedback, isFileModifyingCommand, getWorkingDir } from './executor.js';
import { isCommand, handleCommand } from './commands.js';
import { readInput, loadCommandHistory, saveCommandHistory } from './input.js';
import { StreamStats } from './stats.js';
import { ThinkParser } from './think-parser.js';
import { processAndDisplayDiffs } from './diff-display.js';
import { extractCodeBlocks } from './parser.js';
import { processMentions } from './mentions.js';
import { logger } from './logger.js';
import { quickScanProject, buildQuickContext } from './analyzer.js';
import { loadMemory, saveMemory, buildMemoryContext } from './memory.js';

// Konfiguracja marked dla terminala
marked.use(markedTerminal({
  code: chalk.cyan,
  blockquote: chalk.gray.italic,
  html: chalk.gray,
  heading: chalk.green.bold,
  firstHeading: chalk.magenta.bold,
  hr: chalk.reset,
  listitem: chalk.reset,
  list: chalk.reset,
  table: chalk.reset,
  paragraph: chalk.reset,
  strong: chalk.bold,
  em: chalk.italic,
  codespan: chalk.yellow,
  del: chalk.dim.gray.strikethrough,
  link: chalk.blue,
  href: chalk.blue.underline,
}));

// Maksymalna liczba automatycznych prób naprawy błędów
const MAX_AUTO_RETRY = 3;
// Maksymalna liczba automatycznych kontynuacji po sukcesie (kroków planu)
const MAX_AUTO_CONTINUE = 10;

/**
 * Ustawia nasłuchiwanie na Ctrl+C do przerwania generowania.
 * Używa process SIGINT zamiast raw mode żeby nie blokować stdin.
 * @returns {{abortController: AbortController, cleanup: () => void}}
 */
function setupAbortListener() {
  const abortController = new AbortController();
  let cleaned = false;

  const onSigint = () => {
    if (!cleaned) {
      console.log(chalk.yellow('\n\n⏹ Przerwano generowanie (Ctrl+C)...'));
      abortController.abort();
    }
  };

  // Nasłuchuj SIGINT (Ctrl+C) - nie wymaga raw mode
  process.on('SIGINT', onSigint);

  const cleanup = () => {
    if (!cleaned) {
      cleaned = true;
      process.removeListener('SIGINT', onSigint);
    }
  };

  return { abortController, cleanup };
}

/**
 * Wysyła wiadomości do modelu i zwraca odpowiedź.
 * @param {Object} state - Stan konwersacji
 * @param {Array} apiMessages - Wiadomości dla API
 * @returns {Promise<{response: string, error: Error|null}>}
 */
async function getAIResponse(state, apiMessages) {
  console.log(chalk.blue('\n┌─ Odpowiedź AI ') + chalk.blue('─'.repeat(60)));
  console.log(chalk.gray('  (Ctrl+C aby przerwać)'));
  process.stdout.write('\n');

  let fullResponse = '';
  let responseStats = null;
  const stats = new StreamStats();

  // Setup abort listener
  const { abortController, cleanup } = setupAbortListener();
  const abortSignal = abortController.signal;

  // ThinkParser — rozdziela <think>...</think> od odpowiedzi
  let thinkingStarted = false;
  const thinkParser = new ThinkParser({
    onThinkToken: (token) => {
      if (abortSignal.aborted) return;
      if (!thinkingStarted) {
        process.stdout.write(chalk.gray('\n💭 Myślenie:\n'));
        thinkingStarted = true;
      }
      process.stdout.write(chalk.gray.italic(token));
      stats.addThinkingTokens(1);
    },
    onResponseToken: (token) => {
      if (abortSignal.aborted) return;
      if (thinkingStarted) {
        process.stdout.write(chalk.gray('\n\n'));
        thinkingStarted = false;
      }
      process.stdout.write(token);
      stats.addResponseTokens(1);
    },
  });

  stats.start();

  try {
    if (CONFIG.DEMO_MODE) {
      await streamDemo(
        apiMessages[apiMessages.length - 1]?.content || '',
        (token) => thinkParser.push(token),
        (text, demoStats) => { fullResponse = text; responseStats = demoStats; },
        {
          messages: state.conversation.messages.map(m => ({ role: m.role, content: m.content })),
          hasProjectContext: !!state.projectContext,
          abortSignal,
        },
      );
    } else {
      await new Promise((resolve, reject) => {
        streamOllama(
          apiMessages,
          (token) => thinkParser.push(token),
          (text, ollamaStats) => { fullResponse = text; responseStats = ollamaStats; resolve(); },
          (err) => reject(err),
          abortSignal,
        );
      });
    }
  } catch (err) {
    cleanup();
    if (err.name === 'AbortError' || abortSignal.aborted) {
      console.log(chalk.blue('\n└' + '─'.repeat(76)) + '\n');
      return { response: fullResponse || null, error: null, aborted: true, thinkParser };
    }
    console.log(chalk.red(`\n\n✖ Błąd komunikacji z AI: ${err.message}`));
    console.log(chalk.blue('\n└' + '─'.repeat(76)) + '\n');
    return { response: null, error: err, thinkParser };
  }

  cleanup();

  thinkParser.flush();
  stats.stop();

  if (responseStats?.eval_count) {
    stats.setOllamaStats(responseStats);
  } else {
    stats.estimateFromText(thinkParser.responseText);
  }

  process.stdout.write('\n');
  const statsLine = thinkParser.thinkingText
    ? stats.formatWithThinking()
    : stats.format();
  console.log(chalk.gray('\n' + statsLine));
  console.log(chalk.blue('\n└' + '─'.repeat(76)) + '\n');

  const cleanResponse = thinkParser.responseText || fullResponse;
  return { response: cleanResponse, error: null, thinkParser };
}

/**
 * Buduje system prompt z wszystkimi kontekstami.
 * @param {Object} state
 * @returns {string}
 */
function buildSystemPrompt(state) {
  let systemPrompt = CONFIG.SYSTEM_PROMPT;

  if (state.quickContext) {
    systemPrompt += state.quickContext;
  }
  if (state.projectContext) {
    systemPrompt += state.projectContext;
  }
  if (state.memoryContext) {
    systemPrompt += state.memoryContext;
  }

  return systemPrompt;
}

/**
 * Odświeża kontekst projektu po komendach modyfikujących pliki.
 * Używa katalogu roboczego z executora (śledzi cd).
 * @param {Object} state
 * @param {Array} cmdResults
 */
async function refreshContextIfNeeded(state, cmdResults) {
  const fileModified = cmdResults.some(r => !r.skipped && r.success && isFileModifyingCommand(r.command));
  if (!fileModified) return;

  try {
    const cwd = getWorkingDir();
    const freshScan = await quickScanProject(cwd, 3);
    state.quickContext = buildQuickContext(freshScan);
    logger.info('CHAT', `Odświeżono kontekst projektu (${cwd})`);
  } catch (err) {
    logger.warn('CHAT', `Nie udało się odświeżyć kontekstu: ${err.message}`);
  }
}

/**
 * Wysyła jedną wiadomość do modelu i przetwarza odpowiedź.
 * Zwraca obiekt z wynikiem jednej iteracji.
 *
 * @param {Object} state
 * @returns {Promise<{done: boolean, ok: boolean, hasCommands: boolean, hasErrors: boolean, feedback: string|null}>}
 */
async function runOneAIIteration(state) {
  const { conversation } = state;

  const systemPrompt = buildSystemPrompt(state);
  const apiMessages = buildMessageWindow(
    conversation.messages.map(m => ({ role: m.role, content: m.content })),
    systemPrompt,
  );

  logger.debug('CHAT', `Wysyłam ${apiMessages.length} wiadomości do API`);

  const { response, error, aborted } = await getAIResponse(state, apiMessages);

  if (error) {
    logger.error('CHAT', `Błąd komunikacji: ${error.message}`);
    if (conversation.messages.length > 0 &&
        conversation.messages[conversation.messages.length - 1].role === 'user') {
      conversation.messages.pop();
    }
    return { done: true, ok: false, hasCommands: false, hasErrors: false, feedback: null };
  }

  if (aborted) {
    logger.info('CHAT', 'Generowanie przerwane przez użytkownika');
    if (response) {
      conversation.messages.push({
        role: 'assistant',
        content: response + '\n\n[przerwano przez użytkownika]',
        timestamp: new Date().toISOString(),
      });
    }
    return { done: true, ok: true, hasCommands: false, hasErrors: false, feedback: null };
  }

  if (!response) {
    return { done: false, ok: true, hasCommands: false, hasErrors: false, feedback: null };
  }

  // Dodaj odpowiedź do historii
  conversation.messages.push({
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
  });

  // Wyświetl diffy
  const codeBlocks = extractCodeBlocks(response);
  const diffCount = processAndDisplayDiffs(response, codeBlocks);
  if (diffCount > 0) {
    console.log(chalk.gray(`📊 Wyświetlono ${diffCount} zmian w plikach\n`));
  }

  // Obsłuż komendy PowerShell
  const cmdResults = await handlePowerShellCommands(response, state.autoExecute);
  const feedback = formatResultsForFeedback(cmdResults);

  const executedCount = cmdResults.filter(r => !r.skipped).length;
  const hasErrors = cmdResults.some(r => !r.skipped && !r.success);

  // Odśwież kontekst po modyfikacjach plików
  await refreshContextIfNeeded(state, cmdResults);

  return {
    done: false,
    ok: true,
    hasCommands: executedCount > 0,
    hasErrors,
    feedback,
  };
}

/**
 * Przetwarza turę AI: wysyła zapytanie, wykonuje komendy, obsługuje błędy.
 *
 * Dwie pętle:
 * - Kontynuacja (po sukcesie z komendami) — max MAX_AUTO_CONTINUE kroków
 * - Retry (po błędzie) — max MAX_AUTO_RETRY prób naprawy
 *
 * @param {Object} state - Stan konwersacji
 * @returns {Promise<boolean>} - true jeśli sukces, false jeśli błąd komunikacji
 */
async function processAITurn(state) {
  const { conversation } = state;

  logger.info('CHAT', 'Rozpoczynam turę AI');
  logger.debug('CHAT', `Wiadomości w konwersacji: ${conversation.messages.length}`);

  let retryCount = 0;
  let continueCount = 0;

  while (true) {
    logger.debug('CHAT', `Iteracja (kontynuacje: ${continueCount}, retry: ${retryCount})`);

    const result = await runOneAIIteration(state);

    // Błąd komunikacji lub przerwanie — koniec
    if (result.done) {
      return result.ok;
    }

    // Brak odpowiedzi (np. pusty response) — powtórz
    if (!result.ok) continue;

    // Brak komend = odpowiedź konwersacyjna — koniec tury
    if (!result.hasCommands) {
      return true;
    }

    // Komendy bez błędów — kontynuacja planu
    if (!result.hasErrors) {
      continueCount++;

      if (continueCount >= MAX_AUTO_CONTINUE) {
        logger.info('CHAT', `Osiągnięto limit kontynuacji (${MAX_AUTO_CONTINUE})`);
        console.log(chalk.yellow(`\n⏸ Wykonano ${MAX_AUTO_CONTINUE} kroków automatycznie. Kontynuować?\n`));
        return true;
      }

      if (result.feedback) {
        // Odesłij wyniki komend do modelu — niech kontynuuje plan
        conversation.messages.push({
          role: 'user',
          content: result.feedback,
          timestamp: new Date().toISOString(),
        });
        logger.info('CHAT', `Kontynuacja planu (krok ${continueCount}/${MAX_AUTO_CONTINUE})`);
        console.log(chalk.cyan(`\n▶ Kontynuacja planu (krok ${continueCount})...\n`));
      } else {
        // Komendy wykonane ale brak feedbacku (np. pominięte) — koniec
        return true;
      }

      continue;
    }

    // Komendy z błędem — retry
    retryCount++;

    if (retryCount > MAX_AUTO_RETRY) {
      logger.error('CHAT', `Osiągnięto limit prób naprawy (${MAX_AUTO_RETRY})`);
      console.log(chalk.red(`\n⚠ Osiągnięto limit automatycznych prób naprawy (${MAX_AUTO_RETRY}). Proszę o manualną interwencję.\n`));
      return true;
    }

    logger.warn('CHAT', `Błąd w komendzie — naprawa ${retryCount}/${MAX_AUTO_RETRY}`);
    console.log(chalk.yellow(`\n🔄 Błąd w komendzie — próba naprawy (${retryCount}/${MAX_AUTO_RETRY})...\n`));

    // Odesłij diagnostykę błędu do modelu
    conversation.messages.push({
      role: 'user',
      content: result.feedback,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Główna pętla konwersacji.
 */
export async function startChat() {
  // Inicjalizuj logger z env vars
  logger.init();

  logger.info('CHAT', 'Uruchamiam AI Coding CLI');
  logger.debug('CHAT', `Tryb: ${CONFIG.DEMO_MODE ? 'DEMO' : 'PRODUKCJA'}`);

  // Załaduj historię komend
  await loadCommandHistory();
  logger.debug('CHAT', 'Załadowano historię komend');

  // Inicjalizacja konwersacji
  const conversation = createConversation();
  logger.info('CHAT', `Nowa konwersacja: ${conversation.id}`);

  // Załaduj pamięć z poprzednich sesji
  await loadMemory();
  const memoryContext = buildMemoryContext(process.cwd());
  logger.debug('CHAT', `Pamięć załadowana (${memoryContext.length} znaków kontekstu)`);

  // Stan współdzielony z komendami
  const state = {
    conversation,
    projectContext: null,
    quickContext: null,
    memoryContext: memoryContext || null,
    autoExecute: false,
  };

  // Auto-skanowanie struktury projektu
  try {
    logger.debug('CHAT', 'Auto-skanowanie struktury projektu...');
    const cwd = getWorkingDir();
    const quickScan = await quickScanProject(cwd, 3);
    state.quickContext = buildQuickContext(quickScan);
    logger.info('CHAT', `Załadowano strukturę: ${quickScan.files.length} plików, ${quickScan.dirs.length} katalogów`);
  } catch (err) {
    logger.warn('CHAT', `Nie udało się zeskanować projektu: ${err.message}`);
  }

  // Auto-save
  startAutoSave(() => state.conversation);
  logger.debug('CHAT', 'Uruchomiono auto-save');

  try {
    // Banner
    console.clear();
    console.log(chalk.magenta.bold('╔═══════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.magenta.bold('║          🤖 AI Coding Assistant - Local CLI v2.0                     ║'));
    console.log(chalk.magenta.bold('╚═══════════════════════════════════════════════════════════════════════╝'));
    console.log(chalk.gray(`\nModel: ${CONFIG.MODEL_NAME}`));
    console.log(chalk.gray(`Server: ${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}`));
    console.log(chalk.gray(`Rozmowa: ${conversation.id}`));

    // Pokaż status kontekstu projektu
    if (state.quickContext) {
      console.log(chalk.green(`📁 Projekt: struktura załadowana automatycznie`));
      console.log(chalk.gray(`   Lokalizacja: ${process.cwd()}`));
    }

    console.log(chalk.gray('\nKomendy:'));
    console.log(chalk.gray('  /exit     - zapisz i wyjdź'));
    console.log(chalk.gray('  /clear    - wyczyść historię'));
    console.log(chalk.gray('  /info     - konfiguracja'));
    console.log(chalk.gray('  /analyze  - pełna analiza projektu (z zawartością plików)'));
    console.log(chalk.gray('  /autorun  - przełącz auto-wykonywanie komend'));
    console.log(chalk.gray('  /debug    - włącz/wyłącz logowanie'));
    console.log(chalk.gray('  /help     - pełna pomoc\n'));

    // Główna pętla
    logger.debug('CHAT', 'Wchodzę do głównej pętli');

    while (true) {
      const promptLabel = state.autoExecute
        ? chalk.green('Ty') + chalk.yellow(' [AUTO]') + chalk.green(':')
        : chalk.green('Ty:');
      const userInput = await readInput(promptLabel, '💬');

      logger.trace('CHAT', `Input użytkownika: "${userInput.slice(0, 50)}..."`);

      // Komendy
      if (isCommand(userInput.trim())) {
        logger.debug('CHAT', `Komenda: ${userInput.trim().split(/\s+/)[0]}`);
        const result = await handleCommand(userInput.trim(), state);
        logger.debug('CHAT', `Wynik komendy: ${result.action}`);
        if (result.action === 'exit') {
          logger.info('CHAT', 'Użytkownik kończy sesję');
          break;
        }
        continue;
      }

      // Walidacja
      const { valid, sanitized, warnings } = validateInput(userInput);

      if (!valid) {
        logger.warn('CHAT', 'Walidacja nie powiodła się');
        continue;
      }

      for (const w of warnings) {
        console.log(chalk.yellow(`⚠ ${w}`));
        logger.warn('CHAT', `Ostrzeżenie walidacji: ${w}`);
      }

      // Przetwórz @mentions (pliki/foldery)
      const { cleanedInput, context: mentionContext, mentions } = await processMentions(sanitized);

      if (mentions && mentions.length > 0) {
        logger.info('CHAT', `Znaleziono ${mentions.length} @mentions`);
        logger.debug('CHAT', 'Mentions:', mentions);
      }

      // Buduj treść wiadomości z kontekstem plików
      const messageContent = mentionContext
        ? `${cleanedInput}\n${mentionContext}`
        : cleanedInput;

      // Dodaj do historii
      conversation.messages.push({
        role: 'user',
        content: messageContent,
        timestamp: new Date().toISOString(),
      });

      // Przetwórz turę AI (z automatycznym retry przy błędach)
      await processAITurn(state);
    }
  } finally {
    stopAutoSave();
    await saveCommandHistory();
    await saveMemory();
    logger.debug('CHAT', 'Pamięć zapisana');
  }
}
