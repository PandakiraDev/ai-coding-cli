import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';
import { readInput } from '../src/input.js';

describe('input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readInput', () => {
    it('should return single line input when no backslash', async () => {
      inquirer.prompt.mockResolvedValueOnce({ userInput: 'hello world' });

      const result = await readInput('Ty:', '💬');

      expect(result).toBe('hello world');
      expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    });

    it('should handle multiline input with backslash continuation', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ userInput: 'line one\\' })
        .mockResolvedValueOnce({ nextLine: 'line two' });

      const result = await readInput('Ty:', '💬');

      expect(result).toBe('line one\nline two');
      expect(inquirer.prompt).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple continuation lines', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ userInput: 'first\\' })
        .mockResolvedValueOnce({ nextLine: 'second\\' })
        .mockResolvedValueOnce({ nextLine: 'third' });

      const result = await readInput('Ty:', '💬');

      expect(result).toBe('first\nsecond\nthird');
      expect(inquirer.prompt).toHaveBeenCalledTimes(3);
    });

    it('should handle empty input', async () => {
      inquirer.prompt.mockResolvedValueOnce({ userInput: '' });

      const result = await readInput('Ty:');

      expect(result).toBe('');
    });

    it('should handle backslash not at end of line', async () => {
      inquirer.prompt.mockResolvedValueOnce({ userInput: 'path\\to\\file' });

      const result = await readInput('Ty:');

      // Ends with \, so should continue — but let's check the logic
      // Actually 'path\\to\\file' does NOT end with \ (it ends with 'e')
      // Wait — in JS string 'path\\to\\file' the last char is 'e'
      // So this should be single line
      expect(result).toBe('path\\to\\file');
      expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    });

    it('should use default empty prefix when not provided', async () => {
      inquirer.prompt.mockResolvedValueOnce({ userInput: 'test' });

      await readInput('Prompt:');

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({ prefix: '' }),
      ]);
    });

    it('should pass promptMessage and prefix to first prompt', async () => {
      inquirer.prompt.mockResolvedValueOnce({ userInput: 'test' });

      await readInput('My prompt:', '>>');

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          message: 'My prompt:',
          prefix: '>>',
        }),
      ]);
    });

    it('should use continuation prompt for subsequent lines', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ userInput: 'start\\' })
        .mockResolvedValueOnce({ nextLine: 'end' });

      await readInput('Ty:', '💬');

      // Second call should use continuation prompt
      expect(inquirer.prompt).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({
          message: '... ',
          prefix: '',
        }),
      ]);
    });
  });
});
