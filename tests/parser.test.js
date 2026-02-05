import { describe, it, expect } from 'vitest';
import { extractCodeBlocks } from '../src/parser.js';

describe('extractCodeBlocks', () => {
  it('should return empty array for null/undefined/empty', () => {
    expect(extractCodeBlocks(null)).toEqual([]);
    expect(extractCodeBlocks(undefined)).toEqual([]);
    expect(extractCodeBlocks('')).toEqual([]);
  });

  it('should return empty array when no code blocks', () => {
    expect(extractCodeBlocks('Just some text without any code')).toEqual([]);
  });

  it('should extract a single backtick-fenced block', () => {
    const text = 'Hello\n```javascript\nconsole.log("hi");\n```\nBye';
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('javascript');
    expect(blocks[0].code).toBe('console.log("hi");');
    expect(blocks[0].startLine).toBe(2);
    expect(blocks[0].endLine).toBe(4);
    expect(blocks[0].incomplete).toBeUndefined();
  });

  it('should extract multiple blocks', () => {
    const text = '```python\nprint("a")\n```\ntext\n```sql\nSELECT 1;\n```';
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe('python');
    expect(blocks[0].code).toBe('print("a")');
    expect(blocks[1].language).toBe('sql');
    expect(blocks[1].code).toBe('SELECT 1;');
  });

  it('should handle tilde fences', () => {
    const text = '~~~bash\necho hello\n~~~';
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('bash');
    expect(blocks[0].code).toBe('echo hello');
  });

  it('should handle 4+ backtick fences', () => {
    const text = '````javascript\nconst x = 1;\n````';
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('javascript');
    expect(blocks[0].code).toBe('const x = 1;');
  });

  it('should not close a 4-backtick fence with 3 backticks', () => {
    const text = '````javascript\nconst x = 1;\n```\nstill inside\n````';
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe('const x = 1;\n```\nstill inside');
  });

  it('should mark unclosed blocks as incomplete', () => {
    const text = '```python\nprint("hello")\nmore code';
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].incomplete).toBe(true);
    expect(blocks[0].language).toBe('python');
    expect(blocks[0].code).toBe('print("hello")\nmore code');
  });

  it('should use plaintext as default language', () => {
    const text = '```\nsome code\n```';
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('plaintext');
  });

  it('should handle powershell blocks', () => {
    const text = '```powershell\nGet-Process\n```\n```ps1\nGet-Service\n```';
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe('powershell');
    expect(blocks[0].code).toBe('Get-Process');
    expect(blocks[1].language).toBe('ps1');
    expect(blocks[1].code).toBe('Get-Service');
  });

  it('should handle empty code blocks', () => {
    const text = '```javascript\n```';
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe('');
  });

  it('should handle multiline code', () => {
    const text = '```javascript\nconst a = 1;\nconst b = 2;\nconst c = a + b;\nconsole.log(c);\n```';
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe('const a = 1;\nconst b = 2;\nconst c = a + b;\nconsole.log(c);');
  });
});
