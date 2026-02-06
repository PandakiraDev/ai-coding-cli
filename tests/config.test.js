import { describe, it, expect } from 'vitest';
import { CONFIG, OLLAMA_URL } from '../src/config.js';

describe('CONFIG', () => {
  it('should export CONFIG object', () => {
    expect(CONFIG).toBeDefined();
    expect(typeof CONFIG).toBe('object');
  });

  it('should have correct type for string fields', () => {
    expect(typeof CONFIG.MODEL_NAME).toBe('string');
    expect(typeof CONFIG.OLLAMA_HOST).toBe('string');
    expect(typeof CONFIG.SYSTEM_PROMPT).toBe('string');
    expect(typeof CONFIG.HISTORY_DIR).toBe('string');
  });

  it('should have correct type for number fields', () => {
    expect(typeof CONFIG.OLLAMA_PORT).toBe('number');
    expect(typeof CONFIG.REQUEST_TIMEOUT).toBe('number');
    expect(typeof CONFIG.MAX_HISTORY_MESSAGES).toBe('number');
    expect(typeof CONFIG.MAX_INPUT_LENGTH).toBe('number');
    expect(typeof CONFIG.WARN_INPUT_LENGTH).toBe('number');
    expect(typeof CONFIG.AUTO_SAVE_INTERVAL).toBe('number');
    expect(typeof CONFIG.DEMO_STREAM_CHAR_DELAY).toBe('number');
  });

  it('should have correct type for boolean fields', () => {
    expect(typeof CONFIG.DEMO_MODE).toBe('boolean');
  });

  it('should have correct type for array fields', () => {
    expect(Array.isArray(CONFIG.DANGEROUS_COMMANDS)).toBe(true);
    expect(Array.isArray(CONFIG.ANALYZER_EXCLUDED_DIRS)).toBe(true);
    expect(Array.isArray(CONFIG.ANALYZER_EXTENSIONS)).toBe(true);
  });

  it('should have sensible default values', () => {
    expect(CONFIG.OLLAMA_PORT).toBe(56541);
    expect(CONFIG.MAX_HISTORY_MESSAGES).toBe(20);
    expect(CONFIG.MAX_INPUT_LENGTH).toBe(10000);
    expect(CONFIG.WARN_INPUT_LENGTH).toBe(5000);
    expect(CONFIG.ANALYZER_MAX_FILES).toBe(100);
    expect(CONFIG.ANALYZER_MAX_DEPTH).toBe(10);
  });

  it('OLLAMA_URL should point to /api/chat', () => {
    expect(OLLAMA_URL).toContain('/api/chat');
    expect(OLLAMA_URL).toMatch(/^http:\/\/.+\/api\/chat$/);
  });

  it('DANGEROUS_COMMANDS should include critical patterns', () => {
    expect(CONFIG.DANGEROUS_COMMANDS).toContain('Remove-Item');
    expect(CONFIG.DANGEROUS_COMMANDS).toContain('Format-Volume');
    expect(CONFIG.DANGEROUS_COMMANDS).toContain('Invoke-Expression');
  });

  it('ANALYZER_EXCLUDED_DIRS should include node_modules and .git', () => {
    expect(CONFIG.ANALYZER_EXCLUDED_DIRS).toContain('node_modules');
    expect(CONFIG.ANALYZER_EXCLUDED_DIRS).toContain('.git');
  });

  it('ANALYZER_EXTENSIONS should include common file types', () => {
    expect(CONFIG.ANALYZER_EXTENSIONS).toContain('.js');
    expect(CONFIG.ANALYZER_EXTENSIONS).toContain('.ts');
    expect(CONFIG.ANALYZER_EXTENSIONS).toContain('.py');
    expect(CONFIG.ANALYZER_EXTENSIONS).toContain('.json');
    expect(CONFIG.ANALYZER_EXTENSIONS).toContain('.ps1');
  });
});
