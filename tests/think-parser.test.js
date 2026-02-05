import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThinkParser } from '../src/think-parser.js';

describe('ThinkParser', () => {
  let thinkTokens;
  let responseTokens;
  let parser;

  beforeEach(() => {
    thinkTokens = [];
    responseTokens = [];
    parser = new ThinkParser({
      onThinkToken: (t) => thinkTokens.push(t),
      onResponseToken: (t) => responseTokens.push(t),
    });
  });

  describe('basic parsing', () => {
    it('should pass text without think tags to onResponseToken', () => {
      parser.push('Hello world');
      parser.flush();

      expect(responseTokens.join('')).toBe('Hello world');
      expect(thinkTokens.join('')).toBe('');
    });

    it('should separate think block from response', () => {
      parser.push('<think>thinking here</think>response here');
      parser.flush();

      expect(thinkTokens.join('')).toBe('thinking here');
      expect(responseTokens.join('')).toBe('response here');
    });

    it('should handle think block at the start', () => {
      parser.push('<think>analysis</think>The answer is 42');
      parser.flush();

      expect(thinkTokens.join('')).toBe('analysis');
      expect(responseTokens.join('')).toBe('The answer is 42');
    });

    it('should handle think block only (no response)', () => {
      parser.push('<think>just thinking</think>');
      parser.flush();

      expect(thinkTokens.join('')).toBe('just thinking');
      expect(responseTokens.join('')).toBe('');
    });

    it('should handle no think block', () => {
      parser.push('just a response');
      parser.flush();

      expect(thinkTokens.join('')).toBe('');
      expect(responseTokens.join('')).toBe('just a response');
    });
  });

  describe('streaming (chunk-by-chunk)', () => {
    it('should handle tag split across chunks', () => {
      parser.push('<thi');
      parser.push('nk>thought</');
      parser.push('think>response');
      parser.flush();

      expect(thinkTokens.join('')).toBe('thought');
      expect(responseTokens.join('')).toBe('response');
    });

    it('should handle character-by-character streaming', () => {
      const text = '<think>AB</think>CD';
      for (const ch of text) {
        parser.push(ch);
      }
      parser.flush();

      expect(thinkTokens.join('')).toBe('AB');
      expect(responseTokens.join('')).toBe('CD');
    });

    it('should handle chunk that contains partial open tag that does not match', () => {
      parser.push('<th');
      parser.push('is is not a tag');
      parser.flush();

      // '<this is not a tag' should all be response
      expect(responseTokens.join('')).toBe('<this is not a tag');
      expect(thinkTokens.join('')).toBe('');
    });
  });

  describe('accumulated text getters', () => {
    it('should accumulate thinkingText', () => {
      parser.push('<think>part1');
      parser.push(' part2</think>');
      parser.flush();

      expect(parser.thinkingText).toBe('part1 part2');
    });

    it('should accumulate responseText', () => {
      parser.push('<think>hidden</think>visible ');
      parser.push('text');
      parser.flush();

      expect(parser.responseText).toBe('visible text');
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      parser.push('');
      parser.flush();

      expect(responseTokens.join('')).toBe('');
      expect(thinkTokens.join('')).toBe('');
    });

    it('should handle < without matching tag', () => {
      parser.push('a < b');
      parser.flush();

      expect(responseTokens.join('')).toBe('a < b');
    });

    it('should handle angle brackets in normal text', () => {
      parser.push('use array<string> type');
      parser.flush();

      expect(responseTokens.join('')).toBe('use array<string> type');
    });

    it('should handle unclosed think tag at end of stream', () => {
      parser.push('<think>thinking without close');
      parser.flush();

      expect(thinkTokens.join('')).toBe('thinking without close');
    });

    it('should handle multiple think blocks', () => {
      parser.push('<think>first</think>middle<think>second</think>end');
      parser.flush();

      expect(thinkTokens.join('')).toBe('firstsecond');
      expect(responseTokens.join('')).toBe('middleend');
    });

    it('should work with default callbacks (no-op)', () => {
      const p = new ThinkParser();
      p.push('<think>test</think>response');
      p.flush();

      expect(p.thinkingText).toBe('test');
      expect(p.responseText).toBe('response');
    });

    it('should flush partial tag buffer at end', () => {
      parser.push('text<thi');
      parser.flush();

      // '<thi' is a partial open tag match — flush should emit it as response
      expect(responseTokens.join('')).toBe('text<thi');
    });
  });
});
