// think-parser.js - Streaming state-machine dla <think> tagów

const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

const STATE_NORMAL = 'NORMAL';
const STATE_TAG_BUFFER = 'TAG_BUFFER';
const STATE_THINKING = 'THINKING';

/**
 * Parser streamingowy rozdzielający tekst na bloki myślenia (<think>...</think>)
 * i bloki odpowiedzi (reszta).
 *
 * State machine z buforowaniem tagów — nie emituje częściowo dopasowanych tagów.
 */
export class ThinkParser {
  /**
   * @param {{ onThinkToken?: (token: string) => void, onResponseToken?: (token: string) => void }} callbacks
   */
  constructor({ onThinkToken, onResponseToken } = {}) {
    this._onThinkToken = onThinkToken || (() => {});
    this._onResponseToken = onResponseToken || (() => {});

    this._state = STATE_NORMAL;
    this._tagBuffer = '';
    this._targetTag = OPEN_TAG;
    this._thinkingText = '';
    this._responseText = '';
  }

  /** Akumulowany tekst myślenia. */
  get thinkingText() {
    return this._thinkingText;
  }

  /** Akumulowany tekst odpowiedzi (bez <think>). */
  get responseText() {
    return this._responseText;
  }

  /**
   * Karmi parser nowym chunkiem tekstu.
   * Może wywołać callbacki 0+ razy.
   * @param {string} chunk
   */
  push(chunk) {
    // Bufor do grupowania sąsiednich znaków tego samego trybu (batching)
    let batchBuffer = '';
    let batchMode = null; // 'think' | 'response'

    const flushBatch = () => {
      if (batchBuffer.length === 0) return;
      if (batchMode === 'think') {
        this._thinkingText += batchBuffer;
        this._onThinkToken(batchBuffer);
      } else {
        this._responseText += batchBuffer;
        this._onResponseToken(batchBuffer);
      }
      batchBuffer = '';
      batchMode = null;
    };

    const emitChar = (ch, mode) => {
      if (batchMode !== null && batchMode !== mode) {
        flushBatch();
      }
      batchMode = mode;
      batchBuffer += ch;
    };

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      switch (this._state) {
        case STATE_NORMAL:
          if (ch === '<') {
            flushBatch();
            this._tagBuffer = '<';
            this._targetTag = OPEN_TAG;
            this._state = STATE_TAG_BUFFER;
          } else {
            emitChar(ch, 'response');
          }
          break;

        case STATE_THINKING:
          if (ch === '<') {
            flushBatch();
            this._tagBuffer = '<';
            this._targetTag = CLOSE_TAG;
            this._state = STATE_TAG_BUFFER;
          } else {
            emitChar(ch, 'think');
          }
          break;

        case STATE_TAG_BUFFER:
          this._tagBuffer += ch;

          if (this._tagBuffer === this._targetTag) {
            // Tag w pełni dopasowany
            if (this._targetTag === OPEN_TAG) {
              this._state = STATE_THINKING;
            } else {
              this._state = STATE_NORMAL;
            }
            this._tagBuffer = '';
          } else if (this._targetTag.startsWith(this._tagBuffer)) {
            // Częściowe dopasowanie — kontynuuj buforowanie
          } else {
            // Rozbieżność — flush bufora do odpowiedniego emittera
            const mode = this._targetTag === OPEN_TAG ? 'response' : 'think';
            for (const c of this._tagBuffer) {
              emitChar(c, mode);
            }
            this._tagBuffer = '';
            this._state = this._targetTag === OPEN_TAG ? STATE_NORMAL : STATE_THINKING;
          }
          break;
      }
    }

    flushBatch();
  }

  /**
   * Opróżnia bufor na koniec streamu.
   * Wywołaj po ostatnim push().
   */
  flush() {
    if (this._tagBuffer.length > 0) {
      const mode = this._state === STATE_TAG_BUFFER && this._targetTag === CLOSE_TAG
        ? 'think' : 'response';
      if (mode === 'think') {
        this._thinkingText += this._tagBuffer;
        this._onThinkToken(this._tagBuffer);
      } else {
        this._responseText += this._tagBuffer;
        this._onResponseToken(this._tagBuffer);
      }
      this._tagBuffer = '';
    }
    // Reset state do NORMAL po flush
    if (this._state === STATE_TAG_BUFFER) {
      this._state = this._targetTag === CLOSE_TAG ? STATE_THINKING : STATE_NORMAL;
    }
  }
}
