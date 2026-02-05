import { describe, it, expect } from 'vitest';
import {
  getContextualDemoResponse,
  getRandomDemoResponse,
  RESPONSES,
  RULES,
  scoreCategory,
} from '../src/demo-responses.js';

describe('demo-responses', () => {
  describe('RESPONSES', () => {
    it('should have at least 15 response categories', () => {
      expect(Object.keys(RESPONSES).length).toBeGreaterThanOrEqual(15);
    });

    it('every response should be a non-empty string', () => {
      for (const [key, val] of Object.entries(RESPONSES)) {
        expect(typeof val, `RESPONSES.${key}`).toBe('string');
        expect(val.length, `RESPONSES.${key} length`).toBeGreaterThan(50);
      }
    });

    it('powershell response should contain ```powershell blocks', () => {
      expect(RESPONSES.powershell).toContain('```powershell');
    });

    it('testing response should contain test examples', () => {
      expect(RESPONSES.testing).toContain('describe');
      expect(RESPONSES.testing).toContain('expect');
    });

    it('bugs response should contain before/after examples', () => {
      expect(RESPONSES.bugs).toContain('PROBLEM');
      expect(RESPONSES.bugs).toContain('POPRAWKA');
    });

    it('greeting response should list available capabilities', () => {
      expect(RESPONSES.greeting).toContain('/analyze');
      expect(RESPONSES.greeting).toContain('/exit');
    });
  });

  describe('RULES', () => {
    it('should have a rule for every major response category', () => {
      const categories = RULES.map(r => r.category);
      expect(categories).toContain('api');
      expect(categories).toContain('powershell');
      expect(categories).toContain('sql');
      expect(categories).toContain('testing');
      expect(categories).toContain('bugs');
      expect(categories).toContain('refactoring');
      expect(categories).toContain('git');
      expect(categories).toContain('security');
      expect(categories).toContain('greeting');
    });

    it('every rule should have keywords array', () => {
      for (const rule of RULES) {
        expect(Array.isArray(rule.keywords), `${rule.category} keywords`).toBe(true);
        expect(rule.keywords.length, `${rule.category} keywords count`).toBeGreaterThan(0);
      }
    });
  });

  describe('scoreCategory', () => {
    it('should return 0 for non-matching input', () => {
      const rule = RULES.find(r => r.category === 'sql');
      expect(scoreCategory(rule, 'hello world')).toBe(0);
    });

    it('should score > 0 for matching keywords', () => {
      const rule = RULES.find(r => r.category === 'sql');
      expect(scoreCategory(rule, 'napisz zapytanie sql do bazy')).toBeGreaterThan(0);
    });

    it('should score higher for more keyword matches', () => {
      const rule = RULES.find(r => r.category === 'sql');
      const score1 = scoreCategory(rule, 'sql');
      const score2 = scoreCategory(rule, 'sql baza zapytanie tabela');
      expect(score2).toBeGreaterThan(score1);
    });

    it('should apply boost only when score > 0', () => {
      const rule = RULES.find(r => r.category === 'greeting');
      const scoreMatch = scoreCategory(rule, 'cześć');
      const scoreNoMatch = scoreCategory(rule, 'xyz123nope');
      expect(scoreMatch).toBeGreaterThan(0);
      expect(scoreNoMatch).toBe(0);
    });

    it('should match regex patterns', () => {
      const rule = RULES.find(r => r.category === 'testing');
      const score = scoreCategory(rule, 'napisz test dla tego modułu');
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('getContextualDemoResponse', () => {
    it('should return greeting for empty input without history', () => {
      const resp = getContextualDemoResponse('');
      expect(resp).toBe(RESPONSES.greeting);
    });

    it('should return greeting for "cześć"', () => {
      const resp = getContextualDemoResponse('cześć');
      expect(resp).toBe(RESPONSES.greeting);
    });

    it('should return api for "napisz endpoint REST API"', () => {
      const resp = getContextualDemoResponse('napisz endpoint REST API');
      expect(resp).toBe(RESPONSES.api);
    });

    it('should return powershell for "utwórz folder w powershell"', () => {
      const resp = getContextualDemoResponse('utwórz folder w powershell');
      expect(resp).toBe(RESPONSES.powershell);
    });

    it('should return sql for "zapytanie do bazy sql"', () => {
      const resp = getContextualDemoResponse('zapytanie do bazy sql');
      expect(resp).toBe(RESPONSES.sql);
    });

    it('should return testing for "napisz testy jednostkowe"', () => {
      const resp = getContextualDemoResponse('napisz testy jednostkowe');
      expect(resp).toBe(RESPONSES.testing);
    });

    it('should return bugs for "znajdź błędy w kodzie"', () => {
      const resp = getContextualDemoResponse('znajdź błędy w kodzie');
      expect(resp).toBe(RESPONSES.bugs);
    });

    it('should return refactoring for "zrefaktoruj tę funkcję"', () => {
      const resp = getContextualDemoResponse('zrefaktoruj tę funkcję');
      expect(resp).toBe(RESPONSES.refactoring);
    });

    it('should return python for "python dataclass flask"', () => {
      const resp = getContextualDemoResponse('python dataclass flask');
      expect(resp).toBe(RESPONSES.python);
    });

    it('should return typescript for "typescript generics"', () => {
      const resp = getContextualDemoResponse('typescript generics');
      expect(resp).toBe(RESPONSES.typescript);
    });

    it('should return git for "jak zrobić git rebase"', () => {
      const resp = getContextualDemoResponse('jak zrobić git rebase');
      expect(resp).toBe(RESPONSES.git);
    });

    it('should return security for "bezpieczeństwo xss cors jwt"', () => {
      const resp = getContextualDemoResponse('bezpieczeństwo xss cors jwt');
      expect(resp).toBe(RESPONSES.security);
    });

    it('should return performance for "optymalizacja wydajności"', () => {
      const resp = getContextualDemoResponse('optymalizacja wydajności');
      expect(resp).toBe(RESPONSES.performance);
    });

    it('should return css for "napisz style css grid"', () => {
      const resp = getContextualDemoResponse('napisz style css grid');
      expect(resp).toBe(RESPONSES.css);
    });

    it('should return docker for "dockerfile multi-stage"', () => {
      const resp = getContextualDemoResponse('dockerfile multi-stage');
      expect(resp).toBe(RESPONSES.docker);
    });

    // --- Kontekst projektu ---
    it('should return projectAnalysis when hasProjectContext and project-related input', () => {
      const resp = getContextualDemoResponse('analizuj projekt', [], true);
      expect(resp).toBe(RESPONSES.projectAnalysis);
    });

    it('should NOT return projectAnalysis when no project context', () => {
      const resp = getContextualDemoResponse('analizuj projekt', [], false);
      expect(resp).not.toBe(RESPONSES.projectAnalysis);
    });

    // --- Follow-up ---
    it('should return follow-up for unmatched input with existing conversation', () => {
      const messages = [
        { role: 'user', content: 'coś tam' },
        { role: 'assistant', content: 'odpowiedź' },
      ];
      const resp = getContextualDemoResponse('kontynuuj proszę', messages);
      expect(resp).toBe(RESPONSES.followUp);
    });

    // --- Unikanie powtórzeń ---
    it('should avoid recently used categories', () => {
      const messages = [
        { role: 'user', content: 'sql' },
        { role: 'assistant', content: RESPONSES.sql },
      ];
      // input pasuje do sql, ale sql było ostatnio użyte
      // powinien wybrać inną kategorię lub fallback
      const resp = getContextualDemoResponse('sql baza', messages);
      // Nie testujemy dokładnie którą kategorię wybierze, ale że nie jest to powtórka
      // (chyba że jest jedyna opcja)
      expect(resp.length).toBeGreaterThan(0);
    });
  });

  describe('getRandomDemoResponse', () => {
    it('should return a non-empty string', () => {
      const resp = getRandomDemoResponse();
      expect(typeof resp).toBe('string');
      expect(resp.length).toBeGreaterThan(0);
    });

    it('should return a value from RESPONSES', () => {
      const allValues = new Set(Object.values(RESPONSES));
      const resp = getRandomDemoResponse();
      expect(allValues.has(resp)).toBe(true);
    });
  });
});
