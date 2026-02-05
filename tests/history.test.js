import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock fs/promises before importing module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import {
  initHistoryDir,
  generateConversationId,
  sanitizeId,
  createConversation,
  saveConversation,
  loadConversation,
  listConversations,
  buildMessageWindow,
  startAutoSave,
  stopAutoSave,
} from '../src/history.js';

describe('history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopAutoSave();
  });

  describe('initHistoryDir', () => {
    it('should create history directory recursively', async () => {
      await initHistoryDir();
      expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('generateConversationId', () => {
    it('should return a string matching YYYYMMDD-HHmmss-hex pattern', () => {
      const id = generateConversationId();
      expect(id).toMatch(/^\d{8}-\d{6}-[0-9a-f]{4}$/);
    });

    it('should generate unique ids', () => {
      const ids = new Set(Array.from({ length: 20 }, () => generateConversationId()));
      expect(ids.size).toBeGreaterThan(1);
    });
  });

  describe('sanitizeId', () => {
    it('should remove path traversal characters', () => {
      expect(sanitizeId('../../../etc/passwd')).toBe('etcpasswd');
    });

    it('should allow valid characters', () => {
      expect(sanitizeId('20260205-143022-a7b3')).toBe('20260205-143022-a7b3');
    });

    it('should remove special characters', () => {
      expect(sanitizeId('foo/bar\\baz.json')).toBe('foobarbazjson');
    });
  });

  describe('createConversation', () => {
    it('should create a valid conversation object', () => {
      const conv = createConversation();
      expect(conv.id).toMatch(/^\d{8}-\d{6}-[0-9a-f]{4}$/);
      expect(conv.createdAt).toBeDefined();
      expect(conv.updatedAt).toBeDefined();
      expect(conv.model).toBeDefined();
      expect(conv.messages).toEqual([]);
    });
  });

  describe('saveConversation / loadConversation roundtrip', () => {
    it('should save and load conversation correctly', async () => {
      const conv = createConversation();
      conv.messages.push({ role: 'user', content: 'test message' });

      await saveConversation(conv);
      expect(writeFile).toHaveBeenCalledTimes(1);

      const savedData = writeFile.mock.calls[0][1];
      readFile.mockResolvedValueOnce(savedData);

      const loaded = await loadConversation(conv.id);
      expect(loaded.id).toBe(conv.id);
      expect(loaded.messages).toHaveLength(1);
      expect(loaded.messages[0].content).toBe('test message');
    });
  });

  describe('listConversations', () => {
    it('should return empty array when no files', async () => {
      readdir.mockResolvedValueOnce([]);
      const list = await listConversations();
      expect(list).toEqual([]);
    });

    it('should return empty array when readdir fails', async () => {
      readdir.mockRejectedValueOnce(new Error('ENOENT'));
      const list = await listConversations();
      expect(list).toEqual([]);
    });

    it('should parse conversation files and return sorted list', async () => {
      readdir.mockResolvedValueOnce(['a.json', 'b.json']);

      const convA = {
        id: 'a', createdAt: '2026-01-01', updatedAt: '2026-01-01',
        messages: [{ role: 'user', content: 'First message A' }],
      };
      const convB = {
        id: 'b', createdAt: '2026-01-02', updatedAt: '2026-01-02',
        messages: [{ role: 'user', content: 'First message B' }],
      };

      readFile
        .mockResolvedValueOnce(JSON.stringify(convA))
        .mockResolvedValueOnce(JSON.stringify(convB));

      const list = await listConversations();
      expect(list).toHaveLength(2);
      // sorted by updatedAt descending
      expect(list[0].id).toBe('b');
      expect(list[1].id).toBe('a');
      expect(list[0].preview).toBe('First message B');
    });
  });

  describe('buildMessageWindow', () => {
    it('should always include system prompt at the beginning', () => {
      const messages = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ];
      const window = buildMessageWindow(messages, 'You are a helper');
      expect(window[0]).toEqual({ role: 'system', content: 'You are a helper' });
      expect(window).toHaveLength(3);
    });

    it('should limit to maxN messages', () => {
      const messages = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg ${i}`,
      }));
      const window = buildMessageWindow(messages, 'system', 5);
      // 1 system + 5 latest = 6
      expect(window).toHaveLength(6);
      expect(window[0].role).toBe('system');
      expect(window[1].content).toBe('msg 25');
      expect(window[6 - 1].content).toBe('msg 29');
    });

    it('should use CONFIG.MAX_HISTORY_MESSAGES as default', () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        role: 'user',
        content: `msg ${i}`,
      }));
      const window = buildMessageWindow(messages, 'sys');
      // 1 system + 20 (default from CONFIG) = 21
      expect(window).toHaveLength(21);
    });

    it('should handle empty messages', () => {
      const window = buildMessageWindow([], 'system prompt');
      expect(window).toHaveLength(1);
      expect(window[0].role).toBe('system');
    });
  });

  describe('autoSave', () => {
    it('should start and stop without errors', () => {
      const getter = vi.fn().mockReturnValue({ messages: [] });
      startAutoSave(getter);
      stopAutoSave();
    });
  });
});
