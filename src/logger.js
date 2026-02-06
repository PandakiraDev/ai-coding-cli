// logger.js - System logowania i debugowania

import chalk from 'chalk';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_LEVELS = {
  OFF: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
  TRACE: 5,
};

const LEVEL_NAMES = ['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
const LEVEL_COLORS = {
  ERROR: chalk.red,
  WARN: chalk.yellow,
  INFO: chalk.cyan,
  DEBUG: chalk.gray,
  TRACE: chalk.magenta,
};

const LOG_DIR = join(homedir(), '.ai-coding-cli', 'logs');
const LOG_FILE = join(LOG_DIR, `debug-${new Date().toISOString().split('T')[0]}.log`);

class Logger {
  constructor() {
    this.level = LOG_LEVELS.OFF;
    this.writeToFile = false;
    this.showTimestamp = true;
    this.showSource = true;
    this.fileHandle = null;
    this.buffer = [];
    this.flushInterval = null;
  }

  /**
   * Inicjalizuje logger na podstawie zmiennych środowiskowych.
   */
  init() {
    const envLevel = process.env.AI_CLI_LOG_LEVEL?.toUpperCase();
    if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
      this.level = LOG_LEVELS[envLevel];
    }

    if (process.env.AI_CLI_LOG_FILE === 'true' || process.env.AI_CLI_LOG_FILE === '1') {
      this.writeToFile = true;
      this.initFileLogging();
    }

    if (this.level > LOG_LEVELS.OFF) {
      console.log(chalk.gray(`\n📋 Logger aktywny: poziom ${LEVEL_NAMES[this.level]}`));
      if (this.writeToFile) {
        console.log(chalk.gray(`   Plik logów: ${LOG_FILE}\n`));
      }
    }
  }

  /**
   * Ustawia poziom logowania.
   */
  setLevel(level) {
    if (typeof level === 'string') {
      const upperLevel = level.toUpperCase();
      if (LOG_LEVELS[upperLevel] !== undefined) {
        this.level = LOG_LEVELS[upperLevel];
        return true;
      }
      return false;
    }
    if (typeof level === 'number' && level >= 0 && level <= 5) {
      this.level = level;
      return true;
    }
    return false;
  }

  /**
   * Pobiera aktualny poziom logowania.
   */
  getLevel() {
    return LEVEL_NAMES[this.level];
  }

  /**
   * Włącza/wyłącza zapis do pliku.
   */
  async setFileLogging(enabled) {
    this.writeToFile = enabled;
    if (enabled) {
      await this.initFileLogging();
    } else {
      await this.closeFileLogging();
    }
  }

  /**
   * Inicjalizuje logowanie do pliku.
   */
  async initFileLogging() {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });

      // Flush buffer co 2 sekundy
      this.flushInterval = setInterval(() => this.flushBuffer(), 2000);

      // Zapisz nagłówek sesji
      const header = `\n${'='.repeat(60)}\n` +
        `Sesja rozpoczęta: ${new Date().toISOString()}\n` +
        `${'='.repeat(60)}\n`;
      await fs.appendFile(LOG_FILE, header);
    } catch (err) {
      console.error(chalk.red(`Błąd inicjalizacji logowania do pliku: ${err.message}`));
      this.writeToFile = false;
    }
  }

  /**
   * Zamyka logowanie do pliku.
   */
  async closeFileLogging() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flushBuffer();
  }

  /**
   * Zapisuje bufor do pliku.
   */
  async flushBuffer() {
    if (this.buffer.length === 0) return;

    try {
      const content = this.buffer.join('\n') + '\n';
      this.buffer = [];
      await fs.appendFile(LOG_FILE, content);
    } catch (err) {
      // Cicha obsługa błędów
    }
  }

  /**
   * Formatuje wiadomość logu.
   */
  formatMessage(level, source, message, data) {
    const parts = [];

    if (this.showTimestamp) {
      const time = new Date().toISOString().split('T')[1].slice(0, 12);
      parts.push(chalk.gray(`[${time}]`));
    }

    const levelColor = LEVEL_COLORS[level] || chalk.white;
    parts.push(levelColor(`[${level.padEnd(5)}]`));

    if (this.showSource && source) {
      parts.push(chalk.blue(`[${source}]`));
    }

    parts.push(message);

    return parts.join(' ');
  }

  /**
   * Formatuje dane dla pliku logu (bez kolorów).
   */
  formatForFile(level, source, message, data) {
    const time = new Date().toISOString();
    let line = `${time} [${level}]`;
    if (source) line += ` [${source}]`;
    line += ` ${message}`;
    if (data !== undefined) {
      try {
        line += ` | ${JSON.stringify(data)}`;
      } catch {
        line += ` | [Object]`;
      }
    }
    return line;
  }

  /**
   * Loguje wiadomość.
   */
  log(level, source, message, data) {
    const levelNum = LOG_LEVELS[level];
    if (levelNum > this.level) return;

    // Wyświetl w konsoli
    const formatted = this.formatMessage(level, source, message, data);
    console.log(formatted);

    if (data !== undefined && this.level >= LOG_LEVELS.DEBUG) {
      console.log(chalk.gray('  └─'), typeof data === 'object' ? data : chalk.gray(data));
    }

    // Zapisz do pliku
    if (this.writeToFile) {
      this.buffer.push(this.formatForFile(level, source, message, data));
    }
  }

  // Metody skrótowe
  error(source, message, data) { this.log('ERROR', source, message, data); }
  warn(source, message, data) { this.log('WARN', source, message, data); }
  info(source, message, data) { this.log('INFO', source, message, data); }
  debug(source, message, data) { this.log('DEBUG', source, message, data); }
  trace(source, message, data) { this.log('TRACE', source, message, data); }

  // Specjalne metody do logowania konkretnych zdarzeń

  /**
   * Loguje request do API.
   */
  apiRequest(endpoint, payload) {
    this.debug('API', `→ ${endpoint}`, this.level >= LOG_LEVELS.TRACE ? payload : undefined);
  }

  /**
   * Loguje response z API.
   */
  apiResponse(endpoint, status, data) {
    const msg = `← ${endpoint} [${status}]`;
    if (status >= 400) {
      this.error('API', msg, data);
    } else {
      this.debug('API', msg, this.level >= LOG_LEVELS.TRACE ? data : undefined);
    }
  }

  /**
   * Loguje wykonanie komendy.
   */
  command(cmd, args) {
    this.info('CMD', `Wykonuję: ${cmd}`, args);
  }

  /**
   * Loguje wynik komendy.
   */
  commandResult(cmd, success, output) {
    if (success) {
      this.debug('CMD', `✔ ${cmd} zakończone`, output?.slice?.(0, 200));
    } else {
      this.warn('CMD', `✖ ${cmd} błąd`, output);
    }
  }

  /**
   * Loguje parsowanie.
   */
  parse(type, input, result) {
    this.trace('PARSE', `${type}: "${input?.slice?.(0, 50) || input}..."`, result);
  }

  /**
   * Loguje zmianę stanu.
   */
  state(component, change) {
    this.debug('STATE', `${component}:`, change);
  }

  /**
   * Loguje zdarzenie streamingu.
   */
  stream(event, data) {
    this.trace('STREAM', event, data);
  }

  /**
   * Loguje operację na pliku.
   */
  file(operation, path, result) {
    this.debug('FILE', `${operation}: ${path}`, result);
  }

  /**
   * Mierzy czas wykonania funkcji.
   */
  async time(label, fn) {
    const start = Date.now();
    this.debug('PERF', `⏱ Start: ${label}`);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug('PERF', `⏱ ${label}: ${duration}ms`);
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      this.error('PERF', `⏱ ${label} błąd po ${duration}ms`, err.message);
      throw err;
    }
  }

  /**
   * Tworzy timer do ręcznego pomiaru.
   */
  startTimer(label) {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        this.debug('PERF', `⏱ ${label}: ${duration}ms`);
        return duration;
      }
    };
  }

  /**
   * Wyświetla podsumowanie statusu loggera.
   */
  status() {
    console.log(chalk.cyan('\n📋 Status Loggera:'));
    console.log(chalk.cyan(`   Poziom: ${LEVEL_NAMES[this.level]}`));
    console.log(chalk.cyan(`   Zapis do pliku: ${this.writeToFile ? 'TAK' : 'NIE'}`));
    if (this.writeToFile) {
      console.log(chalk.cyan(`   Plik: ${LOG_FILE}`));
    }
    console.log(chalk.cyan(`   Timestamp: ${this.showTimestamp ? 'TAK' : 'NIE'}`));
    console.log(chalk.cyan(`   Źródło: ${this.showSource ? 'TAK' : 'NIE'}`));
    console.log();
  }
}

// Singleton
export const logger = new Logger();

// Eksportuj też klasy i stałe dla testów
export { LOG_LEVELS, LEVEL_NAMES, LOG_FILE };
