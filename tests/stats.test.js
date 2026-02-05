import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamStats } from '../src/stats.js';

describe('StreamStats', () => {
  let stats;

  beforeEach(() => {
    stats = new StreamStats();
  });

  describe('start/stop', () => {
    it('should measure elapsed time', () => {
      vi.useFakeTimers();
      stats.start();
      vi.advanceTimersByTime(3200);
      stats.stop();
      vi.useRealTimers();

      expect(stats.elapsedSeconds).toBeCloseTo(3.2, 1);
    });

    it('should return 0 elapsed if never started', () => {
      stats.stop();
      expect(stats.elapsedSeconds).toBe(0);
    });
  });

  describe('addResponseTokens / addThinkingTokens', () => {
    it('should accumulate response tokens', () => {
      stats.addResponseTokens(10);
      stats.addResponseTokens(5);
      expect(stats.totalTokens).toBe(15);
    });

    it('should accumulate thinking tokens', () => {
      stats.addThinkingTokens(20);
      stats.addResponseTokens(30);
      expect(stats.totalTokens).toBe(50);
    });
  });

  describe('setOllamaStats', () => {
    it('should use eval_count from Ollama stats for totalTokens', () => {
      stats.addResponseTokens(999); // Should be overridden
      stats.setOllamaStats({ eval_count: 142, eval_duration: 3_000_000_000 });

      expect(stats.totalTokens).toBe(142);
    });

    it('should calculate tokensPerSecond from Ollama stats', () => {
      stats.setOllamaStats({ eval_count: 100, eval_duration: 2_000_000_000 });

      expect(stats.tokensPerSecond).toBeCloseTo(50, 1);
    });
  });

  describe('estimateFromText', () => {
    it('should estimate ~1 token per 4 characters', () => {
      stats.estimateFromText('Hello World!'); // 12 chars → ceil(12/4) = 3

      expect(stats.totalTokens).toBe(3);
    });

    it('should handle empty text', () => {
      stats.estimateFromText('');
      expect(stats.totalTokens).toBe(0);
    });

    it('should handle null text', () => {
      stats.estimateFromText(null);
      expect(stats.totalTokens).toBe(0);
    });
  });

  describe('tokensPerSecond', () => {
    it('should calculate tokens per second from elapsed time', () => {
      vi.useFakeTimers();
      stats.start();
      vi.advanceTimersByTime(2000); // 2 seconds
      stats.stop();
      vi.useRealTimers();

      stats.addResponseTokens(100);

      expect(stats.tokensPerSecond).toBeCloseTo(50, 1);
    });

    it('should return 0 when elapsed is 0', () => {
      stats.addResponseTokens(100);
      expect(stats.tokensPerSecond).toBe(0);
    });

    it('should prefer Ollama stats over manual calculation', () => {
      vi.useFakeTimers();
      stats.start();
      vi.advanceTimersByTime(10000);
      stats.stop();
      vi.useRealTimers();

      stats.addResponseTokens(50);
      stats.setOllamaStats({ eval_count: 200, eval_duration: 4_000_000_000 });

      // Should use Ollama stats: 200 / 4 = 50 tok/s
      expect(stats.tokensPerSecond).toBeCloseTo(50, 1);
    });
  });

  describe('format', () => {
    it('should format basic stats string', () => {
      vi.useFakeTimers();
      stats.start();
      vi.advanceTimersByTime(3200);
      stats.stop();
      vi.useRealTimers();

      stats.addResponseTokens(142);

      const result = stats.format();
      expect(result).toContain('3.2s');
      expect(result).toContain('142 tok');
      expect(result).toContain('tok/s');
    });
  });

  describe('formatWithThinking', () => {
    it('should format stats with thinking/response split', () => {
      vi.useFakeTimers();
      stats.start();
      vi.advanceTimersByTime(3200);
      stats.stop();
      vi.useRealTimers();

      stats.addThinkingTokens(45);
      stats.addResponseTokens(97);

      const result = stats.formatWithThinking();
      expect(result).toContain('3.2s');
      expect(result).toContain('45 tok');
      expect(result).toContain('97 tok');
      expect(result).toContain('tok/s');
    });
  });
});
