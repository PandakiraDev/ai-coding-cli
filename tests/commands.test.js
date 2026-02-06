import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn(),
}));

import { isCommand, handleCommand } from '../src/commands.js';

describe('commands', () => {
  let state;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      conversation: {
        id: 'test-id',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model: 'test-model',
      },
      projectContext: null,
      autoExecute: false,
    };
  });

  describe('isCommand', () => {
    it('should recognize commands starting with /', () => {
      expect(isCommand('/exit')).toBe(true);
      expect(isCommand('/autorun')).toBe(true);
      expect(isCommand('/info')).toBe(true);
    });

    it('should not recognize non-commands', () => {
      expect(isCommand('hello')).toBe(false);
      expect(isCommand('autorun')).toBe(false);
    });
  });

  describe('/autorun command', () => {
    it('should toggle autoExecute from false to true', async () => {
      const result = await handleCommand('/autorun', state);

      expect(state.autoExecute).toBe(true);
      expect(result.action).toBe('continue');
    });

    it('should toggle autoExecute from true to false', async () => {
      state.autoExecute = true;

      const result = await handleCommand('/autorun', state);

      expect(state.autoExecute).toBe(false);
      expect(result.action).toBe('continue');
    });

    it('should toggle twice returning to original state', async () => {
      expect(state.autoExecute).toBe(false);

      await handleCommand('/autorun', state);
      expect(state.autoExecute).toBe(true);

      await handleCommand('/autorun', state);
      expect(state.autoExecute).toBe(false);
    });
  });

  describe('/info command', () => {
    it('should return continue action', async () => {
      const result = await handleCommand('/info', state);
      expect(result.action).toBe('continue');
    });

    it('should show autoExecute status', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleCommand('/info', state);

      const calls = consoleSpy.mock.calls.map(c => c[0]);
      const hasAutoExecute = calls.some(c => typeof c === 'string' && c.includes('Auto-execute'));
      expect(hasAutoExecute).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('/clear command', () => {
    it('should clear messages and project context', async () => {
      state.conversation.messages.push({ role: 'user', content: 'test' });
      state.projectContext = 'some context';

      const result = await handleCommand('/clear', state);

      expect(state.conversation.messages.length).toBe(0);
      expect(state.projectContext).toBeNull();
      expect(result.action).toBe('cleared');
    });
  });

  describe('unknown command', () => {
    it('should handle unknown commands', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await handleCommand('/unknown', state);

      expect(result.action).toBe('continue');

      // Should suggest using /help
      const calls = consoleSpy.mock.calls.map(c => c[0]);
      const hasHelpSuggestion = calls.some(c => typeof c === 'string' && c.includes('/help'));
      expect(hasHelpSuggestion).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
