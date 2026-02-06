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
import { handlePowerShellCommands, formatResultsForFeedback, isFileModifyingCommand } from './executor.js';
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
 * Przetwarza turę AI: wysyła zapytanie, wykonuje komendy, obsługuje błędy.
 * @param {Object} state - Stan konwersacji
 * @returns {Promise<boolean>} - true jeśli sukces, false jeśli błąd komunikacji
 */
async function processAITurn(state) {
  const { conversation } = state;

  logger.info('CHAT', 'Rozpoczynam turę AI');
  logger.debug('CHAT', `Wiadomości w konwersacji: ${conversation.messages.length}`);
  logger.state('CHAT', { autoExecute: state.autoExecute, hasProjectContext: !!state.projectContext });

  for (let attempt = 0; attempt <= MAX_AUTO_RETRY; attempt++) {
    logger.debug('CHAT', `Próba ${attempt + 1}/${MAX_AUTO_RETRY + 1}`);

    // Buduj system prompt (opcjonalnie z kontekstem projektu)
    let systemPrompt = CONFIG.SYSTEM_PROMPT;

    // Dodaj szybki kontekst struktury (zawsze jeśli dostępny)
    if (state.quickContext) {
      systemPrompt += state.quickContext;
      logger.trace('CHAT', 'Dodano szybki kontekst struktury do prompta');
    }

    // Dodaj pełny kontekst projektu (jeśli użyto /analyze)
    if (state.projectContext) {
      systemPrompt += state.projectContext;
      logger.trace('CHAT', 'Dodano pełny kontekst projektu do prompta');
    }

    // Dodaj kontekst pamięci
    if (state.memoryContext) {
      systemPrompt += state.memoryContext;
      logger.trace('CHAT', 'Dodano kontekst pamięci do prompta');
    }

    // Buduj okno wiadomości dla API
    const apiMessages = buildMessageWindow(
      conversation.messages.map(m => ({ role: m.role, content: m.content })),
      systemPrompt,
    );

    logger.debug('CHAT', `Wysyłam ${apiMessages.length} wiadomości do API`);
    logger.trace('CHAT', 'Ostatnia wiadomość:', apiMessages[apiMessages.length - 1]?.content?.slice(0, 100));

    // Pobierz odpowiedź AI
    const { response, error, aborted } = await getAIResponse(state, apiMessages);

    if (error) {
      logger.error('CHAT', `Błąd komunikacji: ${error.message}`);
      // Usuń ostatnią wiadomość użytkownika z historii przy błędzie komunikacji
      if (conversation.messages.length > 0 &&
          conversation.messages[conversation.messages.length - 1].role === 'user') {
        conversation.messages.pop();
        logger.debug('CHAT', 'Usunięto ostatnią wiadomość użytkownika');
      }
      return false;
    }

    // Jeśli przerwano - zapisz częściową odpowiedź i zakończ
    if (aborted) {
      logger.info('CHAT', 'Generowanie przerwane przez użytkownika');
      if (response) {
        conversation.messages.push({
          role: 'assistant',
          content: response + '\n\n[przerwano przez użytkownika]',
          timestamp: new Date().toISOString(),
        });
        logger.debug('CHAT', `Zapisano częściową odpowiedź (${response.length} znaków)`);
      }
      return true;
    }

    if (!response) continue;

    // Dodaj odpowiedź do historii
    conversation.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    });

    // Wyświetl diffy jeśli są w odpowiedzi
    const codeBlocks = extractCodeBlocks(response);
    const diffCount = processAndDisplayDiffs(response, codeBlocks);
    if (diffCount > 0) {
      console.log(chalk.gray(`📊 Wyświetlono ${diffCount} zmian w plikach\n`));
    }

    // Obsłuż komendy PowerShell
    const cmdResults = await handlePowerShellCommands(response, state.autoExecute);
    const feedback = formatResultsForFeedback(cmdResults);

    // Odśwież kontekst projektu po komendach modyfikujących pliki
    const fileModified = cmdResults.some(r => !r.skipped && r.success && isFileModifyingCommand(r.command));
    if (fileModified) {
      try {
        const cwd = process.cwd();
        const freshScan = await quickScanProject(cwd, 3);
        state.quickContext = buildQuickContext(freshScan);
        logger.info('CHAT', 'Odświeżono kontekst projektu po modyfikacji plików');
      } catch (err) {
        logger.warn('CHAT', `Nie udało się odświeżyć kontekstu: ${err.message}`);
      }
    }

    // Sprawdź czy były błędy
    const hasErrors = cmdResults.some(r => !r.skipped && !r.success);

    if (!hasErrors) {
      // Sukces! Możemy zakończyć
      return true;
    }

    // Były błędy - sprawdź czy możemy ponowić
    if (attempt < MAX_AUTO_RETRY) {
      logger.warn('CHAT', `Błędy w komendach - próba naprawy ${attempt + 1}/${MAX_AUTO_RETRY}`);
      console.log(chalk.yellow(`\n🔄 Wykryto błędy w komendach - próba naprawy (${attempt + 1}/${MAX_AUTO_RETRY})...\n`));

      // Dodaj feedback jako wiadomość użytkownika
      conversation.messages.push({
        role: 'user',
        content: feedback,
        timestamp: new Date().toISOString(),
      });

      logger.trace('CHAT', 'Feedback dla modelu:', feedback?.slice(0, 200));

      // Kontynuuj pętlę - model spróbuje naprawić
    } else {
      logger.error('CHAT', `Osiągnięto limit prób (${MAX_AUTO_RETRY})`);
      console.log(chalk.red(`⚠ Osiągnięto limit automatycznych prób (${MAX_AUTO_RETRY}). Proszę o manualną interwencję.\n`));
      return true; // Zwróć true żeby nie usuwać wiadomości
    }
  }

  logger.info('CHAT', 'Tura AI zakończona pomyślnie');
  return true;
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
    const cwd = process.cwd();
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
