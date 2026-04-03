import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema, saveRunResult, queryCosts } from '../../../db/client.js'
import type { RunResult } from '../../../types/index.js'

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
    models: ['gpt-4o', 'claude-haiku'],
    cases: [
      {
        case_id: 'case-1',
        prompt: 'What is 2+2?',
        criteria: 'Correct answer',
        responses: {
          'gpt-4o': {
            model_id: 'gpt-4o',
            text: '4',
            input_tokens: 100,
            output_tokens: 50,
            latency_ms: 450,
            cost_usd: 0.005,
          },
          'claude-haiku': {
            model_id: 'claude-haiku',
            text: '4',
            input_tokens: 100,
            output_tokens: 50,
            latency_ms: 300,
            cost_usd: 0.001,
          },
        },
        scores: {
          'gpt-4o': { accuracy: 10, completeness: 10, conciseness: 10, total: 9.8, reasoning: 'Correct' },
          'claude-haiku': { accuracy: 10, completeness: 9, conciseness: 10, total: 9.5, reasoning: 'Correct' },
        },
        winner: 'gpt-4o',
      },
    ],
    summary: {
      'gpt-4o': {
        model_id: 'gpt-4o',
        avg_total: 9.8,
        avg_accuracy: 10,
        avg_completeness: 10,
        avg_conciseness: 10,
        avg_latency_ms: 450,
        avg_tokens_per_sec: 0,
        total_cost_usd: 0.142,
        win_rate: 100,
        wins: 1,
        cases_run: 15,
        avg_solve_rate: 0,
      },
      'claude-haiku': {
        model_id: 'claude-haiku',
        avg_total: 9.5,
        avg_accuracy: 10,
        avg_completeness: 9,
        avg_conciseness: 10,
        avg_latency_ms: 300,
        avg_tokens_per_sec: 0,
        total_cost_usd: 0.0156,
        win_rate: 0,
        wins: 0,
        cases_run: 15,
        avg_solve_rate: 0,
      },
    },
    ...overrides,
  }
}

describe('queryCosts', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
  })

  it('returns aggregated costs grouped by model', () => {
    saveRunResult(db, makeRunResult(), 'general')

    const rows = queryCosts(db, {})
    expect(rows.length).toBe(2)

    const gpt = rows.find(r => r.model_id === 'gpt-4o')
    expect(gpt).toBeDefined()
    expect(gpt!.runs).toBe(1)
    expect(gpt!.cases).toBe(15)
    expect(gpt!.cost).toBeCloseTo(0.142, 3)

    const claude = rows.find(r => r.model_id === 'claude-haiku')
    expect(claude).toBeDefined()
    expect(claude!.cost).toBeCloseTo(0.0156, 3)
  })

  it('aggregates across multiple runs', () => {
    saveRunResult(db, makeRunResult(), 'general')
    saveRunResult(db, makeRunResult({ run_id: 'test-run-2' }), 'reasoning')

    const rows = queryCosts(db, {})
    const gpt = rows.find(r => r.model_id === 'gpt-4o')
    expect(gpt).toBeDefined()
    expect(gpt!.runs).toBe(2)
    expect(gpt!.cases).toBe(30)
    expect(gpt!.cost).toBeCloseTo(0.284, 3)
  })

  it('sorts by cost descending', () => {
    saveRunResult(db, makeRunResult(), 'general')

    const rows = queryCosts(db, {})
    expect(rows.length).toBe(2)
    // gpt-4o costs more, should be first
    expect(rows[0].model_id).toBe('gpt-4o')
    expect(rows[1].model_id).toBe('claude-haiku')
  })

  it('filters by --since time range', () => {
    // Recent run: 1 day ago (always within 7d)
    const recentTs = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    saveRunResult(db, makeRunResult({ timestamp: recentTs }), 'general')
    // Old run: far in the past
    saveRunResult(db, makeRunResult({
      run_id: 'old-run',
      timestamp: '2020-01-01T00:00:00Z',
    }), 'general')

    const rows = queryCosts(db, { since: '7d' })
    const gpt = rows.find(r => r.model_id === 'gpt-4o')
    // Should only include the recent run, not the 2020 run
    expect(gpt).toBeDefined()
    expect(gpt!.runs).toBe(1)
  })

  it('returns empty array when no data', () => {
    const rows = queryCosts(db, {})
    expect(rows.length).toBe(0)
  })

  it('handles models with zero cost', () => {
    saveRunResult(db, makeRunResult({
      models: ['qwen2.5:32b'],
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
          },
          scores: {
            'qwen2.5:32b': { accuracy: 10, completeness: 10, conciseness: 10, total: 9.2, reasoning: 'Correct' },
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
      },
    }), 'general')

    const rows = queryCosts(db, {})
    expect(rows.length).toBe(1)
    expect(rows[0].cost).toBe(0)
  })
})
