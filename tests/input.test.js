// tests/input.test.js - Testy modułu input (readline-based)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockowanie readline jest skomplikowane, więc testujemy eksporty i pomocnicze funkcje

// Mock fs promises
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn().mockRejectedValue(new Error('Not found')),
    writeFile: vi.fn().mockResolvedValue(),
    mkdir: vi.fn().mockResolvedValue(),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockRejectedValue(new Error('Not found')),
    access: vi.fn().mockRejectedValue(new Error('Not found')),
  },
}));

describe('input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exports', () => {
    it('should export readInput function', async () => {
      const module = await import('../src/input.js');
      expect(typeof module.readInput).toBe('function');
    });

    it('should export readConfirm function', async () => {
      const module = await import('../src/input.js');
      expect(typeof module.readConfirm).toBe('function');
    });

    it('should export readChoice function', async () => {
      const module = await import('../src/input.js');
      expect(typeof module.readChoice).toBe('function');
    });

    it('should export loadCommandHistory function', async () => {
      const module = await import('../src/input.js');
      expect(typeof module.loadCommandHistory).toBe('function');
    });

    it('should export saveCommandHistory function', async () => {
      const module = await import('../src/input.js');
      expect(typeof module.saveCommandHistory).toBe('function');
    });
  });

  describe('loadCommandHistory', () => {
    it('should not throw when file does not exist', async () => {
      const { loadCommandHistory } = await import('../src/input.js');
      await expect(loadCommandHistory()).resolves.not.toThrow();
    });
  });

  describe('saveCommandHistory', () => {
    it('should not throw when saving', async () => {
      const { saveCommandHistory } = await import('../src/input.js');
      await expect(saveCommandHistory()).resolves.not.toThrow();
    });
  });
});
