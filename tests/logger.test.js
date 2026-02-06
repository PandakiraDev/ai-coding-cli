// tests/logger.test.js - Testy modułu logger

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LOG_LEVELS, LEVEL_NAMES } from '../src/logger.js';

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset logger state
    logger.level = LOG_LEVELS.OFF;
    logger.writeToFile = false;
  });

  describe('LOG_LEVELS', () => {
    it('should have correct level values', () => {
      expect(LOG_LEVELS.OFF).toBe(0);
      expect(LOG_LEVELS.ERROR).toBe(1);
      expect(LOG_LEVELS.WARN).toBe(2);
      expect(LOG_LEVELS.INFO).toBe(3);
      expect(LOG_LEVELS.DEBUG).toBe(4);
      expect(LOG_LEVELS.TRACE).toBe(5);
    });
  });

  describe('LEVEL_NAMES', () => {
    it('should have correct level names', () => {
      expect(LEVEL_NAMES[0]).toBe('OFF');
      expect(LEVEL_NAMES[1]).toBe('ERROR');
      expect(LEVEL_NAMES[2]).toBe('WARN');
      expect(LEVEL_NAMES[3]).toBe('INFO');
      expect(LEVEL_NAMES[4]).toBe('DEBUG');
      expect(LEVEL_NAMES[5]).toBe('TRACE');
    });
  });

  describe('setLevel', () => {
    it('should set level by string', () => {
      expect(logger.setLevel('INFO')).toBe(true);
      expect(logger.level).toBe(LOG_LEVELS.INFO);
    });

    it('should be case insensitive', () => {
      expect(logger.setLevel('debug')).toBe(true);
      expect(logger.level).toBe(LOG_LEVELS.DEBUG);
    });

    it('should reject invalid string', () => {
      expect(logger.setLevel('INVALID')).toBe(false);
    });

    it('should set level by number', () => {
      expect(logger.setLevel(3)).toBe(true);
      expect(logger.level).toBe(3);
    });

    it('should reject invalid number', () => {
      expect(logger.setLevel(-1)).toBe(false);
      expect(logger.setLevel(10)).toBe(false);
    });
  });

  describe('getLevel', () => {
    it('should return current level name', () => {
      logger.level = LOG_LEVELS.WARN;
      expect(logger.getLevel()).toBe('WARN');
    });
  });

  describe('log methods', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.level = LOG_LEVELS.TRACE; // Enable all logs
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should not log when level is OFF', () => {
      logger.level = LOG_LEVELS.OFF;
      logger.info('TEST', 'message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log error when level is ERROR', () => {
      logger.level = LOG_LEVELS.ERROR;
      logger.error('TEST', 'error message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not log info when level is ERROR', () => {
      logger.level = LOG_LEVELS.ERROR;
      logger.info('TEST', 'info message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log all levels when level is TRACE', () => {
      logger.level = LOG_LEVELS.TRACE;

      logger.error('TEST', 'error');
      logger.warn('TEST', 'warn');
      logger.info('TEST', 'info');
      logger.debug('TEST', 'debug');
      logger.trace('TEST', 'trace');

      expect(consoleSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('specialized methods', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.level = LOG_LEVELS.DEBUG;
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('apiRequest should log at DEBUG level', () => {
      logger.apiRequest('/api/chat', { model: 'test' });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('command should log at INFO level', () => {
      logger.command('Get-Process', { autoExecute: false });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('state should log at DEBUG level', () => {
      logger.state('CHAT', { autoExecute: true });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('startTimer', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.level = LOG_LEVELS.DEBUG;
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should return timer with end method', () => {
      const timer = logger.startTimer('test');
      expect(typeof timer.end).toBe('function');
    });

    it('should log duration on end', () => {
      const timer = logger.startTimer('test operation');
      const duration = timer.end();
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('formatMessage', () => {
    it('should include source when showSource is true', () => {
      logger.showSource = true;
      const formatted = logger.formatMessage('INFO', 'TEST', 'message');
      expect(formatted).toContain('TEST');
    });

    it('should not include timestamp when showTimestamp is false', () => {
      logger.showTimestamp = false;
      const formatted = logger.formatMessage('INFO', 'TEST', 'message');
      // Timestamp pattern: [HH:MM:SS.mmm]
      expect(formatted).not.toMatch(/\[\d{2}:\d{2}:\d{2}/);
    });
  });
});
