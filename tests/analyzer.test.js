import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { readdir, readFile, stat } from 'fs/promises';
import { analyzeProject, buildFileTree, buildProjectContext } from '../src/analyzer.js';

describe('analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildFileTree', () => {
    it('should return placeholder for empty array', () => {
      expect(buildFileTree([])).toBe('(brak plików)');
      expect(buildFileTree(null)).toBe('(brak plików)');
    });

    it('should build tree for flat files', () => {
      const tree = buildFileTree(['index.js', 'package.json']);
      expect(tree).toContain('index.js');
      expect(tree).toContain('package.json');
    });

    it('should build tree with directories', () => {
      const tree = buildFileTree(['src/index.js', 'src/config.js', 'package.json']);
      expect(tree).toContain('src/');
      expect(tree).toContain('index.js');
      expect(tree).toContain('config.js');
      expect(tree).toContain('package.json');
    });
  });

  describe('buildProjectContext', () => {
    it('should return empty string for null analysis', () => {
      expect(buildProjectContext(null)).toBe('');
    });

    it('should return empty string when no files', () => {
      expect(buildProjectContext({ files: [], contents: {}, skipped: [] })).toBe('');
    });

    it('should include file contents', () => {
      const analysis = {
        rootPath: '/project',
        files: ['index.js'],
        contents: { 'index.js': 'console.log("hello");' },
        totalSize: 21,
        skipped: [],
      };
      const ctx = buildProjectContext(analysis);
      expect(ctx).toContain('KONTEKST PROJEKTU');
      expect(ctx).toContain('index.js');
      expect(ctx).toContain('console.log("hello")');
      expect(ctx).toContain('KONIEC KONTEKSTU');
    });

    it('should mention skipped items', () => {
      const analysis = {
        rootPath: '/project',
        files: ['a.js'],
        contents: { 'a.js': 'x' },
        totalSize: 1,
        skipped: ['reason1', 'reason2'],
      };
      const ctx = buildProjectContext(analysis);
      expect(ctx).toContain('Pominięte: 2');
    });
  });

  describe('analyzeProject', () => {
    it('should scan directory and collect files', async () => {
      readdir.mockResolvedValueOnce([
        { name: 'index.js', isDirectory: () => false, isFile: () => true },
        { name: 'readme.md', isDirectory: () => false, isFile: () => true },
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
      ]);

      stat
        .mockResolvedValueOnce({ size: 100 })
        .mockResolvedValueOnce({ size: 200 });

      readFile
        .mockResolvedValueOnce('const x = 1;')
        .mockResolvedValueOnce('# README');

      const result = await analyzeProject('/test-project');

      expect(result.files).toHaveLength(2);
      expect(result.files).toContain('index.js');
      expect(result.files).toContain('readme.md');
      expect(result.totalSize).toBe(300);
    });

    it('should exclude node_modules and .git', async () => {
      readdir.mockResolvedValueOnce([
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'src', isDirectory: () => true, isFile: () => false },
      ]);

      // src directory
      readdir.mockResolvedValueOnce([
        { name: 'app.js', isDirectory: () => false, isFile: () => true },
      ]);

      stat.mockResolvedValueOnce({ size: 50 });
      readFile.mockResolvedValueOnce('const app = 1;');

      const result = await analyzeProject('/project');

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('app.js');
    });

    it('should skip files with unsupported extensions', async () => {
      readdir.mockResolvedValueOnce([
        { name: 'image.png', isDirectory: () => false, isFile: () => true },
        { name: 'data.bin', isDirectory: () => false, isFile: () => true },
        { name: 'app.js', isDirectory: () => false, isFile: () => true },
      ]);

      stat.mockResolvedValueOnce({ size: 50 });
      readFile.mockResolvedValueOnce('const x = 1;');

      const result = await analyzeProject('/project');

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toBe('app.js');
    });

    it('should skip files exceeding size limit', async () => {
      readdir.mockResolvedValueOnce([
        { name: 'big.js', isDirectory: () => false, isFile: () => true },
        { name: 'small.js', isDirectory: () => false, isFile: () => true },
      ]);

      stat
        .mockResolvedValueOnce({ size: 100 * 1024 }) // 100KB > 50KB limit
        .mockResolvedValueOnce({ size: 100 });

      readFile.mockResolvedValueOnce('small content');

      const result = await analyzeProject('/project');

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toBe('small.js');
      expect(result.skipped.length).toBeGreaterThan(0);
    });

    it('should handle unreadable directories gracefully', async () => {
      readdir.mockRejectedValueOnce(new Error('EACCES'));

      const result = await analyzeProject('/no-access');

      expect(result.files).toHaveLength(0);
      expect(result.skipped.length).toBeGreaterThan(0);
    });
  });
});
