import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import axios from 'axios';
import { streamDemo, checkConnection } from '../src/ollama.js';

describe('ollama', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('streamDemo', () => {
    it('should stream tokens and call onComplete with full text', async () => {
      const tokens = [];
      let completed = '';

      await streamDemo(
        'powershell',
        (token) => tokens.push(token),
        (fullText) => { completed = fullText; },
      );

      expect(tokens.length).toBeGreaterThan(0);
      expect(completed.length).toBeGreaterThan(0);
      expect(tokens.join('')).toBe(completed);
    });

    it('should return contextual response based on input', async () => {
      let text = '';
      await streamDemo('sql query', () => {}, (full) => { text = full; });
      expect(text).toContain('SQL');
    });

    it('should handle empty-ish input by returning some demo response', async () => {
      let text = '';
      await streamDemo('random something', () => {}, (full) => { text = full; });
      expect(text.length).toBeGreaterThan(0);
    });

    it('should accept messages and hasProjectContext opts', async () => {
      let text = '';
      const messages = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ];

      await streamDemo(
        'napisz testy',
        () => {},
        (full) => { text = full; },
        { messages, hasProjectContext: false },
      );

      expect(text.length).toBeGreaterThan(0);
    });

    it('should return project analysis response when hasProjectContext is true', async () => {
      let text = '';
      await streamDemo(
        'analizuj projekt',
        () => {},
        (full) => { text = full; },
        { messages: [], hasProjectContext: true },
      );

      expect(text).toContain('projekt');
    });

    it('should return follow-up when no keywords match but conversation exists', async () => {
      let text = '';
      const messages = [
        { role: 'user', content: 'something' },
        { role: 'assistant', content: 'response' },
      ];

      await streamDemo(
        'kontynuuj',
        () => {},
        (full) => { text = full; },
        { messages },
      );

      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe('checkConnection', () => {
    it('should return true in demo mode', async () => {
      const result = await checkConnection();
      expect(result).toBe(true);
    });
  });

  describe('streamOllama (mocked)', () => {
    it('should be importable', async () => {
      const { streamOllama } = await import('../src/ollama.js');
      expect(typeof streamOllama).toBe('function');
    });
  });
});
