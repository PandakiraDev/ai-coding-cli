// stats.js - Statystyki streamingu (czas, tokeny, tok/s)

/**
 * Klasa zbierająca statystyki streamingu odpowiedzi.
 */
export class StreamStats {
  constructor() {
    this._startTime = 0;
    this._elapsed = 0;
    this._responseTokens = 0;
    this._thinkingTokens = 0;
    this._ollamaStats = null;
  }

  /** Zapamiętaj moment startu. */
  start() {
    this._startTime = Date.now();
  }

  /** Oblicz elapsed od startu. */
  stop() {
    if (this._startTime > 0) {
      this._elapsed = Date.now() - this._startTime;
    }
  }

  /** Dodaj tokeny odpowiedzi. */
  addResponseTokens(count) {
    this._responseTokens += count;
  }

  /** Dodaj tokeny myślenia. */
  addThinkingTokens(count) {
    this._thinkingTokens += count;
  }

  /**
   * Ustawia statystyki z Ollama (done=true JSON).
   * @param {{ eval_count?: number, eval_duration?: number, prompt_eval_count?: number, prompt_eval_duration?: number }} obj
   */
  setOllamaStats(obj) {
    this._ollamaStats = obj;
  }

  /**
   * Szacuje tokeny na podstawie tekstu (~1 tok / 4 znaki).
   * @param {string} text
   */
  estimateFromText(text) {
    if (!text) return;
    const estimated = Math.ceil(text.length / 4);
    this._responseTokens = estimated;
  }

  /** Elapsed w sekundach. */
  get elapsedSeconds() {
    return this._elapsed / 1000;
  }

  /** Łączna liczba tokenów (response + thinking). */
  get totalTokens() {
    if (this._ollamaStats?.eval_count) {
      return this._ollamaStats.eval_count;
    }
    return this._responseTokens + this._thinkingTokens;
  }

  /** Tokeny na sekundę. */
  get tokensPerSecond() {
    if (this._ollamaStats?.eval_count && this._ollamaStats?.eval_duration) {
      // eval_duration w nanosekundach
      const seconds = this._ollamaStats.eval_duration / 1e9;
      return seconds > 0 ? this._ollamaStats.eval_count / seconds : 0;
    }
    const seconds = this.elapsedSeconds;
    return seconds > 0 ? this.totalTokens / seconds : 0;
  }

  /**
   * Formatowanie: "⏱ 3.2s | 142 tok | 44.4 tok/s"
   */
  format() {
    const time = this.elapsedSeconds.toFixed(1);
    const tokens = this.totalTokens;
    const tps = this.tokensPerSecond.toFixed(1);
    return `\u23F1 ${time}s | ${tokens} tok | ${tps} tok/s`;
  }

  /**
   * Formatowanie z podziałem thinking/response:
   * "⏱ 3.2s | 💭 45 tok | 📝 97 tok | 44.4 tok/s"
   */
  formatWithThinking() {
    const time = this.elapsedSeconds.toFixed(1);
    const tps = this.tokensPerSecond.toFixed(1);
    return `\u23F1 ${time}s | \uD83D\uDCAD ${this._thinkingTokens} tok | \uD83D\uDCDD ${this._responseTokens} tok | ${tps} tok/s`;
  }
}
