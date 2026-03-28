import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema, saveRunResult, queryHistory, parseSince } from '../client.js'
import type { RunResult } from '../../types/index.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  return db
}

function makeRunResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    run_id: 'test-run-1',
    name: 'Test Run',
    timestamp: '2026-03-25T12:00:00Z',
    models: ['qwen2.5:32b', 'llama4:8b'],
    cases: [
      {
        case_id: 'case-1',
        prompt: 'What is 2+2?',
        criteria: 'Correct answer',
        responses: {
          'qwen2.5:32b': {
            model_id: 'qwen2.5:32b',
            text: '4',
            input_tokens: 10,
            output_tokens: 5,
            latency_ms: 1200,
            cost_usd: 0,
          },
          'llama4:8b': {
            model_id: 'llama4:8b',
            text: '4',
            input_tokens: 10,
            output_tokens: 5,
            latency_ms: 800,
            cost_usd: 0,
          },
        },
        scores: {
          'qwen2.5:32b': { accuracy: 10, completeness: 10, conciseness: 10, total: 9.2, reasoning: 'Correct' },
          'llama4:8b': { accuracy: 8, completeness: 9, conciseness: 9, total: 8.7, reasoning: 'Correct' },
        },
        winner: 'qwen2.5:32b',
      },
    ],
    summary: {
      'qwen2.5:32b': {
        model_id: 'qwen2.5:32b',
        avg_total: 9.2,
        avg_accuracy: 10,
        avg_completeness: 10,
        avg_conciseness: 10,
        avg_latency_ms: 1200,
        avg_tokens_per_sec: 0,
        total_cost_usd: 0,
        win_rate: 100,
        wins: 1,
        cases_run: 1,
        avg_solve_rate: 0,
      },
      'llama4:8b': {
        model_id: 'llama4:8b',
        avg_total: 8.7,
        avg_accuracy: 8,
        avg_completeness: 9,
        avg_conciseness: 9,
        avg_latency_ms: 800,
        avg_tokens_per_sec: 0,
        total_cost_usd: 0,
        win_rate: 0,
        wins: 0,
        cases_run: 1,
        avg_solve_rate: 0,
      },
    },
    ...overrides,
  }
}

describe('client', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
  })

  describe('initSchema', () => {
    it('creates tables without errors', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      ).all() as Array<{ name: string }>
      expect(tables.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('saveRunResult', () => {
    it('inserts eval_results rows for each model', () => {
      const result = makeRunResult()
      saveRunResult(db, result, 'general')

      const rows = db.prepare('SELECT * FROM eval_results ORDER BY model_id').all() as Array<Record<string, unknown>>
      expect(rows.length).toBe(2)
      expect(rows[0].model_id).toBe('llama4:8b')
      expect(rows[1].model_id).toBe('qwen2.5:32b')
      expect(rows[1].score).toBe(9.2)
      expect(rows[1].pack).toBe('general')
    })

    it('inserts question_results for each case per model', () => {
      const result = makeRunResult()
      saveRunResult(db, result, 'general')

      const rows = db.prepare('SELECT * FROM question_results ORDER BY model_id').all() as Array<Record<string, unknown>>
      expect(rows.length).toBe(2) // 1 case * 2 models
      expect(rows[0].case_id).toBe('case-1')
    })

    it('upserts models_registry entries', () => {
      const result = makeRunResult()
      saveRunResult(db, result, 'general')

      const rows = db.prepare('SELECT * FROM models_registry ORDER BY model_id').all() as Array<Record<string, unknown>>
      expect(rows.length).toBe(2)

      const qwen = rows.find(r => r.model_id === 'qwen2.5:32b')
      expect(qwen).toBeDefined()
      expect(qwen!.total_runs).toBe(1)
      expect(qwen!.best_score).toBe(9.2)
    })

    it('increments total_runs on subsequent saves', () => {
      const result1 = makeRunResult()
      saveRunResult(db, result1, 'general')

      const result2 = makeRunResult({ run_id: 'test-run-2' })
      saveRunResult(db, result2, 'general')

      const row = db.prepare("SELECT * FROM models_registry WHERE model_id = 'qwen2.5:32b'").get() as Record<string, unknown>
      expect(row.total_runs).toBe(2)
    })

    it('updates best_score when a higher score is achieved', () => {
      const result1 = makeRunResult()
      saveRunResult(db, result1, 'general')

      const result2 = makeRunResult({
        run_id: 'test-run-2',
        summary: {
          'qwen2.5:32b': {
            model_id: 'qwen2.5:32b',
            avg_total: 9.8,
            avg_accuracy: 10,
            avg_completeness: 10,
            avg_conciseness: 10,
            avg_latency_ms: 1100,
            avg_tokens_per_sec: 0,
            total_cost_usd: 0,
            win_rate: 100,
            wins: 1,
            cases_run: 1,
            avg_solve_rate: 0,
          },
          'llama4:8b': {
            model_id: 'llama4:8b',
            avg_total: 8.7,
            avg_accuracy: 8,
            avg_completeness: 9,
            avg_conciseness: 9,
            avg_latency_ms: 800,
            avg_tokens_per_sec: 0,
            total_cost_usd: 0,
            win_rate: 0,
            wins: 0,
            cases_run: 1,
            avg_solve_rate: 0,
          },
        },
      })
      saveRunResult(db, result2, 'general')

      const row = db.prepare("SELECT * FROM models_registry WHERE model_id = 'qwen2.5:32b'").get() as Record<string, unknown>
      expect(row.best_score).toBe(9.8)
    })

    it('handles multiple models correctly', () => {
      const result = makeRunResult()
      saveRunResult(db, result, 'general')

      const evalCount = (db.prepare('SELECT COUNT(*) as count FROM eval_results').get() as { count: number }).count
      const questionCount = (db.prepare('SELECT COUNT(*) as count FROM question_results').get() as { count: number }).count
      const registryCount = (db.prepare('SELECT COUNT(*) as count FROM models_registry').get() as { count: number }).count

      expect(evalCount).toBe(2)
      expect(questionCount).toBe(2)
      expect(registryCount).toBe(2)
    })
  })

  describe('queryHistory', () => {
    beforeEach(() => {
      saveRunResult(db, makeRunResult(), 'general')
      saveRunResult(db, makeRunResult({
        run_id: 'test-run-2',
        timestamp: '2026-03-24T12:00:00Z',
      }), 'reasoning')
    })

    it('returns all rows with default options', () => {
      const rows = queryHistory(db, {})
      expect(rows.length).toBe(4) // 2 models * 2 runs
    })

    it('filters by model', () => {
      const rows = queryHistory(db, { modelId: 'qwen2.5:32b' })
      expect(rows.length).toBe(2)
      expect(rows.every(r => r.model_id === 'qwen2.5:32b')).toBe(true)
    })

    it('filters by pack', () => {
      const rows = queryHistory(db, { pack: 'reasoning' })
      expect(rows.length).toBe(2)
      expect(rows.every(r => r.pack === 'reasoning')).toBe(true)
    })

    it('respects limit', () => {
      const rows = queryHistory(db, { limit: 2 })
      expect(rows.length).toBe(2)
    })

    it('sorts by score descending', () => {
      const rows = queryHistory(db, { orderBy: 'score' })
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i - 1].score).toBeGreaterThanOrEqual(rows[i].score)
      }
    })

    it('sorts by date descending by default', () => {
      const rows = queryHistory(db, {})
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i - 1].run_at >= rows[i].run_at).toBe(true)
      }
    })

    it('filters by since (time-based)', () => {
      // Save a very old result
      saveRunResult(db, makeRunResult({
        run_id: 'old-run',
        timestamp: '2020-01-01T00:00:00Z',
      }), 'general')

      const rows = queryHistory(db, { since: '7d' })
      // Should exclude the old run
      expect(rows.every(r => r.run_at > '2020-01-01')).toBe(true)
    })
  })

  describe('parseSince', () => {
    it('parses hours', () => {
      const result = parseSince('24h')
      expect(result).toBeInstanceOf(Date)
      const now = new Date()
      const diff = now.getTime() - result!.getTime()
      // Should be approximately 24 hours (allow 1 minute tolerance)
      expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000)
      expect(diff).toBeLessThan(25 * 60 * 60 * 1000)
    })

    it('parses days', () => {
      const result = parseSince('7d')
      expect(result).toBeInstanceOf(Date)
      const now = new Date()
      const diff = now.getTime() - result!.getTime()
      expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
      expect(diff).toBeLessThan(8 * 24 * 60 * 60 * 1000)
    })

    it('parses weeks', () => {
      const result = parseSince('1w')
      expect(result).toBeInstanceOf(Date)
      const now = new Date()
      const diff = now.getTime() - result!.getTime()
      expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
      expect(diff).toBeLessThan(8 * 24 * 60 * 60 * 1000)
    })

    it('returns null for invalid format', () => {
      expect(parseSince('abc')).toBeNull()
      expect(parseSince('7m')).toBeNull()
      expect(parseSince('')).toBeNull()
    })

    it('handles 30d correctly', () => {
      const result = parseSince('30d')
      expect(result).toBeInstanceOf(Date)
      const now = new Date()
      const diff = now.getTime() - result!.getTime()
      expect(diff).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
    })
  })
})
