// progress.js - Spinner i progress bar dla długich operacji

import chalk from 'chalk';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PROGRESS_CHARS = ['░', '▒', '▓', '█'];

/**
 * Klasa Spinner - animowany spinner.
 */
export class Spinner {
  constructor(message = 'Ładowanie...') {
    this.message = message;
    this.frameIndex = 0;
    this.interval = null;
    this.startTime = null;
  }

  /**
   * Uruchamia spinner.
   */
  start() {
    this.startTime = Date.now();
    this.frameIndex = 0;

    // Ukryj kursor
    process.stdout.write('\x1B[?25l');

    this.interval = setInterval(() => {
      const frame = SPINNER_FRAMES[this.frameIndex];
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);

      process.stdout.write(`\r${chalk.cyan(frame)} ${this.message} ${chalk.gray(`(${elapsed}s)`)}`);

      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
    }, 80);
  }

  /**
   * Aktualizuje wiadomość.
   * @param {string} message - nowa wiadomość
   */
  update(message) {
    this.message = message;
  }

  /**
   * Zatrzymuje spinner z sukcesem.
   * @param {string} [message] - opcjonalna wiadomość końcowa
   */
  success(message) {
    this.stop();
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`\r${chalk.green('✔')} ${message || this.message} ${chalk.gray(`(${elapsed}s)`)}`);
  }

  /**
   * Zatrzymuje spinner z błędem.
   * @param {string} [message] - opcjonalna wiadomość błędu
   */
  fail(message) {
    this.stop();
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`\r${chalk.red('✖')} ${message || this.message} ${chalk.gray(`(${elapsed}s)`)}`);
  }

  /**
   * Zatrzymuje spinner.
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Pokaż kursor
    process.stdout.write('\x1B[?25h');
    // Wyczyść linię
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  }
}

/**
 * Klasa ProgressBar - pasek postępu.
 */
export class ProgressBar {
  constructor(options = {}) {
    this.total = options.total || 100;
    this.width = options.width || 40;
    this.current = 0;
    this.message = options.message || '';
  }

  /**
   * Aktualizuje postęp.
   * @param {number} current - aktualny postęp
   * @param {string} [message] - opcjonalna wiadomość
   */
  update(current, message) {
    this.current = Math.min(current, this.total);
    if (message) this.message = message;

    const percent = Math.round((this.current / this.total) * 100);
    const filled = Math.round((this.current / this.total) * this.width);
    const empty = this.width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percentStr = `${percent}%`.padStart(4);

    process.stdout.write(`\r${bar} ${percentStr} ${this.message}`);
  }

  /**
   * Kończy progress bar.
   * @param {string} [message] - wiadomość końcowa
   */
  complete(message) {
    this.update(this.total);
    console.log();
    if (message) {
      console.log(chalk.green(`✔ ${message}`));
    }
  }
}

/**
 * Animowany tekst "thinking".
 */
export class ThinkingIndicator {
  constructor() {
    this.dots = 0;
    this.interval = null;
  }

  start() {
    process.stdout.write('\x1B[?25l'); // Ukryj kursor
    this.interval = setInterval(() => {
      this.dots = (this.dots + 1) % 4;
      const dotsStr = '.'.repeat(this.dots).padEnd(3);
      process.stdout.write(`\r${chalk.gray('💭 Myślę' + dotsStr)}`);
    }, 400);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\x1B[?25h'); // Pokaż kursor
    process.stdout.write('\r' + ' '.repeat(20) + '\r');
  }
}

/**
 * Pomocnicza funkcja do wykonania operacji ze spinnerem.
 * @param {string} message - wiadomość
 * @param {Function} operation - async funkcja do wykonania
 * @returns {Promise<any>}
 */
export async function withSpinner(message, operation) {
  const spinner = new Spinner(message);
  spinner.start();

  try {
    const result = await operation();
    spinner.success();
    return result;
  } catch (err) {
    spinner.fail(err.message);
    throw err;
  }
}
