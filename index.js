#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import hljs from 'highlight.js';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CONFIG, OLLAMA_URL } from './config.js';
import { getContextualDemoResponse } from './demo-responses.js';

const execAsync = promisify(exec);

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

// Historia konwersacji
const conversationHistory = [];

// // Funkcja do wysyłania zapytania do Ollama
// async function queryOllama(prompt, spinner) {
//   try {
//     const response = await axios.post(
//       OLLAMA_URL,
//       {
//         model: CONFIG.MODEL_NAME,
//         prompt: prompt,
//         stream: false,
//       },
//       {
//         timeout: CONFIG.REQUEST_TIMEOUT,
//         headers: {
//           'Content-Type': 'application/json',
//         },
//       }
//     );

//     return response.data.response;
//   } catch (error) {
//     spinner.fail(chalk.red('Błąd połączenia z serwerem AI'));
    
//     if (error.code === 'ECONNREFUSED') {
//       console.log(chalk.yellow(`\n⚠️  Nie można połączyć się z ${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}`));
//       console.log(chalk.yellow('Sprawdź:'));
//       console.log(chalk.yellow('  1. Czy VPN jest aktywny?'));
//       console.log(chalk.yellow('  2. Czy Ollama działa na serwerze?'));
//       console.log(chalk.yellow('  3. Czy adres IP w config.js jest poprawny?'));
//     } else if (error.code === 'ETIMEDOUT') {
//       console.log(chalk.yellow('\n⚠️  Timeout - serwer nie odpowiedział w czasie'));
//     } else {
//       console.log(chalk.red(`\n❌ Błąd: ${error.message}`));
//     }
    
//     return null;
//   }
// }


// Funkcja do wysyłania zapytania do Ollama (lub tryb demo)
async function queryOllama(prompt, spinner) {
  // TRYB DEMO - zwróć przykładową odpowiedź
  if (CONFIG.DEMO_MODE) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const demoResponse = getContextualDemoResponse(prompt);
        resolve(demoResponse);
      }, CONFIG.DEMO_DELAY);
    });
  }
  
  // NORMALNY TRYB - połączenie z prawdziwą Ollamą
  try {
    const response = await axios.post(
      OLLAMA_URL,
      {
        model: CONFIG.MODEL_NAME,
        prompt: prompt,
        stream: false,
      },
      {
        timeout: CONFIG.REQUEST_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.response;
  } catch (error) {
    spinner.fail(chalk.red('Błąd połączenia z serwerem AI'));
    
    if (error.code === 'ECONNREFUSED') {
      console.log(chalk.yellow(`\n⚠️  Nie można połączyć się z ${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}`));
      console.log(chalk.yellow('Sprawdź:'));
      console.log(chalk.yellow('  1. Czy VPN jest aktywny?'));
      console.log(chalk.yellow('  2. Czy Ollama działa na serwerze?'));
      console.log(chalk.yellow('  3. Czy adres IP w config.js jest poprawny?'));
    } else if (error.code === 'ETIMEDOUT') {
      console.log(chalk.yellow('\n⚠️  Timeout - serwer nie odpowiedział w czasie'));
    } else {
      console.log(chalk.red(`\n❌ Błąd: ${error.message}`));
    }
    
    return null;
  }
}


// Formatowanie i wyświetlanie odpowiedzi
function displayResponse(response) {
  console.log(chalk.blue('\n┌─ Odpowiedź AI ') + chalk.blue('─'.repeat(60)));
  
  // Renderowanie markdown z kolorowaniem składni
  const formattedResponse = marked(response);
  console.log(formattedResponse);
  
  console.log(chalk.blue('└' + '─'.repeat(76)) + '\n');
}

// Ekstrakcja bloków kodu z odpowiedzi
function extractCodeBlocks(response) {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = codeBlockRegex.exec(response)) !== null) {
    blocks.push({
      language: match[1] || 'plaintext',
      code: match[2].trim(),
    });
  }

  return blocks;
}

// Wykonywanie komend PowerShell
async function executeCommand(command) {
  if (!CONFIG.AUTO_EXECUTE_COMMANDS) {
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.yellow(`Wykonać komendę w PowerShell?\n${chalk.cyan(command)}`),
      default: false,
    },
  ]);

  if (confirm) {
    const spinner = ora('Wykonywanie komendy...').start();
    try {
      const { stdout, stderr } = await execAsync(command, { shell: 'powershell.exe' });
      spinner.succeed('Komenda wykonana');
      
      if (stdout) {
        console.log(chalk.green('\nWynik:'));
        console.log(stdout);
      }
      if (stderr) {
        console.log(chalk.red('\nOstrzeżenia:'));
        console.log(stderr);
      }
    } catch (error) {
      spinner.fail('Błąd wykonania komendy');
      console.log(chalk.red(error.message));
    }
  }
}

// Detekcja i obsługa komend PowerShell w odpowiedzi
async function handlePowerShellCommands(response) {
  const psRegex = /```(?:powershell|ps1)\n([\s\S]*?)```/g;
  let match;
  const commands = [];

  while ((match = psRegex.exec(response)) !== null) {
    commands.push(match[1].trim());
  }

  for (const command of commands) {
    await executeCommand(command);
  }
}

// Główna pętla konwersacji
async function startChat() {
  console.clear();
  console.log(chalk.magenta.bold('╔═══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.magenta.bold('║          🤖 AI Coding Assistant - Local CLI                          ║'));
  console.log(chalk.magenta.bold('╚═══════════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.gray(`\nModel: ${CONFIG.MODEL_NAME}`));
  console.log(chalk.gray(`Server: ${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}`));
  console.log(chalk.gray('\nKomendy specjalne:'));
  console.log(chalk.gray('  /exit  - wyjście z programu'));
  console.log(chalk.gray('  /clear - wyczyść historię konwersacji'));
  console.log(chalk.gray('  /info  - informacje o konfiguracji\n'));

  while (true) {
    const { userInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'userInput',
        message: chalk.green('Ty:'),
        prefix: '💬',
      },
    ]);

    // Obsługa komend specjalnych
    if (userInput.toLowerCase() === '/exit') {
      console.log(chalk.yellow('\n👋 Do zobaczenia!'));
      process.exit(0);
    }

    if (userInput.toLowerCase() === '/clear') {
      conversationHistory.length = 0;
      console.log(chalk.yellow('\n🗑️  Historia wyczyszczona\n'));
      continue;
    }

    if (userInput.toLowerCase() === '/info') {
      console.log(chalk.cyan('\n📊 Konfiguracja:'));
      console.log(chalk.cyan(`   Model: ${CONFIG.MODEL_NAME}`));
      console.log(chalk.cyan(`   Host: ${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}`));
      console.log(chalk.cyan(`   Auto-execute: ${CONFIG.AUTO_EXECUTE_COMMANDS}`));
      console.log(chalk.cyan(`   Historia: ${conversationHistory.length} wiadomości\n`));
      continue;
    }

    if (!userInput.trim()) {
      continue;
    }

    // Dodaj do historii
    conversationHistory.push({ role: 'user', content: userInput });

    // Buduj kontekst z historii
    const contextPrompt = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // Wyślij zapytanie
    const spinner = ora('Myślę...').start();
    const aiResponse = await queryOllama(contextPrompt, spinner);

    if (aiResponse) {
      spinner.succeed('Gotowe!');
      
      // Dodaj odpowiedź do historii
      conversationHistory.push({ role: 'assistant', content: aiResponse });
      
      // Wyświetl odpowiedź
      displayResponse(aiResponse);
      
      // Obsłuż komendy PowerShell jeśli są
      await handlePowerShellCommands(aiResponse);
    } else {
      // Usuń ostatnie zapytanie z historii jeśli nie udało się
      conversationHistory.pop();
    }
  }
}

// // Sprawdzenie połączenia przy starcie
// async function checkConnection() {
//   const spinner = ora('Sprawdzanie połączenia z serwerem AI...').start();
  
//   try {
//     await axios.get(`http://${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}/api/tags`, {
//       timeout: 5000,
//     });
//     spinner.succeed(chalk.green('Połączenie z serwerem AI OK!'));
//     return true;
//   } catch (error) {
//     spinner.fail(chalk.red('Brak połączenia z serwerem AI'));
//     console.log(chalk.yellow('\n⚠️  Sprawdź config.js i upewnij się, że:'));
//     console.log(chalk.yellow(`   - OLLAMA_HOST = '${CONFIG.OLLAMA_HOST}'`));
//     console.log(chalk.yellow(`   - OLLAMA_PORT = ${CONFIG.OLLAMA_PORT}`));
//     console.log(chalk.yellow('   - VPN jest aktywny'));
//     console.log(chalk.yellow('   - Ollama działa na serwerze\n'));
//     return false;
//   }
// }

// Sprawdzenie połączenia przy starcie
async function checkConnection() {
  // Pomiń sprawdzanie w trybie demo
  if (CONFIG.DEMO_MODE) {
    console.log(chalk.yellow('⚠️  TRYB DEMO - używam przykładowych odpowiedzi'));
    console.log(chalk.yellow('   Zmień DEMO_MODE na false w config.js aby połączyć się z prawdziwym AI\n'));
    return true;
  }
  
  const spinner = ora('Sprawdzanie połączenia z serwerem AI...').start();
  
  try {
    await axios.get(`http://${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}/api/tags`, {
      timeout: 5000,
    });
    spinner.succeed(chalk.green('Połączenie z serwerem AI OK!'));
    return true;
  } catch (error) {
    spinner.fail(chalk.red('Brak połączenia z serwerem AI'));
    console.log(chalk.yellow('\n⚠️  Sprawdź config.js i upewnij się, że:'));
    console.log(chalk.yellow(`   - OLLAMA_HOST = '${CONFIG.OLLAMA_HOST}'`));
    console.log(chalk.yellow(`   - OLLAMA_PORT = ${CONFIG.OLLAMA_PORT}`));
    console.log(chalk.yellow('   - VPN jest aktywny'));
    console.log(chalk.yellow('   - Ollama działa na serwerze\n'));
    return false;
  }
}

// Start aplikacji
(async () => {
  const connected = await checkConnection();
  if (connected) {
    await startChat();
  } else {
    process.exit(1);
  }
})();