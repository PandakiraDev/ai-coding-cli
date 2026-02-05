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
import { handlePowerShellCommands } from './executor.js';
import { isCommand, handleCommand } from './commands.js';
import { readInput } from './input.js';
import { StreamStats } from './stats.js';
import { ThinkParser } from './think-parser.js';

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

/**
 * Główna pętla konwersacji.
 */
export async function startChat() {
  // Inicjalizacja konwersacji
  const conversation = createConversation();

  // Stan współdzielony z komendami
  const state = {
    conversation,
    projectContext: null,
    autoExecute: false,
  };

  // Auto-save
  startAutoSave(() => state.conversation);

  try {
    // Banner
    console.clear();
    console.log(chalk.magenta.bold('╔═══════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.magenta.bold('║          🤖 AI Coding Assistant - Local CLI v2.0                     ║'));
    console.log(chalk.magenta.bold('╚═══════════════════════════════════════════════════════════════════════╝'));
    console.log(chalk.gray(`\nModel: ${CONFIG.MODEL_NAME}`));
    console.log(chalk.gray(`Server: ${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}`));
    console.log(chalk.gray(`Rozmowa: ${conversation.id}`));
    console.log(chalk.gray('\nKomendy:'));
    console.log(chalk.gray('  /exit     - zapisz i wyjdź'));
    console.log(chalk.gray('  /clear    - wyczyść historię'));
    console.log(chalk.gray('  /info     - konfiguracja'));
    console.log(chalk.gray('  /save     - zapisz rozmowę'));
    console.log(chalk.gray('  /history  - lista zapisanych rozmów'));
    console.log(chalk.gray('  /load <id>- wczytaj rozmowę'));
    console.log(chalk.gray('  /analyze  - analizuj projekt'));
    console.log(chalk.gray('  /autorun  - przełącz auto-wykonywanie komend\n'));

    // Główna pętla
    while (true) {
      const promptLabel = state.autoExecute
        ? chalk.green('Ty') + chalk.yellow(' [AUTO]') + chalk.green(':')
        : chalk.green('Ty:');
      const userInput = await readInput(promptLabel, '💬');

      // Komendy
      if (isCommand(userInput.trim())) {
        const result = await handleCommand(userInput.trim(), state);
        if (result.action === 'exit') {
          break;
        }
        continue;
      }

      // Walidacja
      const { valid, sanitized, warnings } = validateInput(userInput);

      if (!valid) continue;

      for (const w of warnings) {
        console.log(chalk.yellow(`⚠ ${w}`));
      }

      // Dodaj do historii
      conversation.messages.push({
        role: 'user',
        content: sanitized,
        timestamp: new Date().toISOString(),
      });

      // Buduj system prompt (opcjonalnie z kontekstem projektu)
      let systemPrompt = CONFIG.SYSTEM_PROMPT;
      if (state.projectContext) {
        systemPrompt += state.projectContext;
      }

      // Buduj okno wiadomości dla API
      const apiMessages = buildMessageWindow(
        conversation.messages.map(m => ({ role: m.role, content: m.content })),
        systemPrompt,
      );

      // Streaming odpowiedzi
      console.log(chalk.blue('\n┌─ Odpowiedź AI ') + chalk.blue('─'.repeat(60)));
      process.stdout.write('\n');

      let fullResponse = '';
      let responseStats = null;
      const stats = new StreamStats();

      // ThinkParser — rozdziela <think>...</think> od odpowiedzi
      let thinkingStarted = false;
      const thinkParser = new ThinkParser({
        onThinkToken: (token) => {
          if (!thinkingStarted) {
            process.stdout.write(chalk.gray('\n💭 Myślenie:\n'));
            thinkingStarted = true;
          }
          process.stdout.write(chalk.gray.italic(token));
          stats.addThinkingTokens(1);
        },
        onResponseToken: (token) => {
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
            sanitized,
            (token) => thinkParser.push(token),
            (text, demoStats) => { fullResponse = text; responseStats = demoStats; },
            {
              messages: conversation.messages.map(m => ({ role: m.role, content: m.content })),
              hasProjectContext: !!state.projectContext,
            },
          );
        } else {
          await new Promise((resolve, reject) => {
            streamOllama(
              apiMessages,
              (token) => thinkParser.push(token),
              (text, ollamaStats) => { fullResponse = text; responseStats = ollamaStats; resolve(); },
              (err) => reject(err),
            );
          });
        }
      } catch (err) {
        console.log(chalk.red(`\n\n✖ Błąd komunikacji z AI: ${err.message}`));
        // Usuń ostatnią wiadomość użytkownika z historii
        conversation.messages.pop();
        console.log(chalk.blue('\n└' + '─'.repeat(76)) + '\n');
        continue;
      }

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

      // Dodaj odpowiedź do historii (bez bloków <think>)
      const cleanResponse = thinkParser.responseText || fullResponse;
      if (cleanResponse) {
        conversation.messages.push({
          role: 'assistant',
          content: cleanResponse,
          timestamp: new Date().toISOString(),
        });

        // Obsłuż komendy PowerShell
        await handlePowerShellCommands(cleanResponse, state.autoExecute);
      }
    }
  } finally {
    stopAutoSave();
  }
}
