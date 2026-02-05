#!/usr/bin/env node

// index.js - Entry point AI Coding CLI v2.0

import chalk from 'chalk';
import { initHistoryDir } from './history.js';
import { checkConnection } from './ollama.js';
import { startChat } from './chat.js';
import { CONFIG } from './config.js';

(async () => {
  try {
    // Inicjalizacja katalogu historii
    await initHistoryDir();

    // Sprawdzenie połączenia
    if (CONFIG.DEMO_MODE) {
      console.log(chalk.yellow('⚠️  TRYB DEMO — używam przykładowych odpowiedzi'));
      console.log(chalk.yellow('   Zmień DEMO_MODE na false w src/config.js aby połączyć się z prawdziwym AI\n'));
    } else {
      const connected = await checkConnection();
      if (!connected) {
        console.log(chalk.red('✖ Brak połączenia z serwerem Ollama'));
        console.log(chalk.yellow(`\n⚠️  Sprawdź:`));
        console.log(chalk.yellow(`   - OLLAMA_HOST = '${CONFIG.OLLAMA_HOST}'`));
        console.log(chalk.yellow(`   - OLLAMA_PORT = ${CONFIG.OLLAMA_PORT}`));
        console.log(chalk.yellow('   - Czy Ollama działa na serwerze?\n'));
        process.exit(1);
      }
    }

    // Start czatu
    await startChat();
  } catch (err) {
    console.error(chalk.red(`\n✖ Krytyczny błąd: ${err.message}`));
    process.exit(1);
  }
})();
