import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema, saveRunResult } from '../../db/client.js'
import { selectModel } from '../selector.js'
import type { RunResult } from '../../types/index.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  return db
}

function seedDb(db: Database.Database): void {
  // Insert eval results directly for more control
  db.prepare(`
    INSERT INTO eval_results (run_id, model_id, provider, pack, score, cases_run, wins, avg_latency_ms, total_cost_usd, run_at)
    VALUES ('run-1', 'qwen2.5:32b', 'ollama', 'general', 9.2, 5, 4, 1200, 0, '2026-03-25T12:00:00Z')
  `).run()

  db.prepare(`
    INSERT INTO eval_results (run_id, model_id, provider, pack, score, cases_run, wins, avg_latency_ms, total_cost_usd, run_at)
    VALUES ('run-1', 'llama4:8b', 'ollama', 'general', 8.7, 5, 1, 800, 0, '2026-03-25T12:00:00Z')
  `).run()

  db.prepare(`
    INSERT INTO eval_results (run_id, model_id, provider, pack, score, cases_run, wins, avg_latency_ms, total_cost_usd, run_at)
    VALUES ('run-1', 'sonar-pro', 'openrouter', 'general', 9.6, 5, 5, 3200, 0.04, '2026-03-25T12:00:00Z')
  `).run()

  db.prepare(`
    INSERT INTO eval_results (run_id, model_id, provider, pack, score, cases_run, wins, avg_latency_ms, total_cost_usd, run_at)
    VALUES ('run-2', 'qwen2.5:32b', 'ollama', 'reasoning', 8.5, 3, 2, 1500, 0, '2026-03-24T12:00:00Z')
  `).run()

  db.prepare(`
    INSERT INTO eval_results (run_id, model_id, provider, pack, score, cases_run, wins, avg_latency_ms, total_cost_usd, run_at)
    VALUES ('run-2', 'mlx-phi3', 'mlx', 'reasoning', 7.2, 3, 0, 600, 0, '2026-03-24T12:00:00Z')
  `).run()
}

describe('selectModel', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
    seedDb(db)
  })

  it('selects the highest scoring model by default', () => {
    const result = selectModel(db, {})
    expect(result).not.toBeNull()
    expect(result!.modelId).toBe('sonar-pro')
    expect(result!.score).toBe(9.6)
  })

  it('filters by pack when packHint is given', () => {
    const result = selectModel(db, { packHint: 'reasoning' })
    expect(result).not.toBeNull()
    expect(result!.modelId).toBe('qwen2.5:32b')
    // avg of 8.5 on reasoning
    expect(result!.score).toBe(8.5)
  })

  it('filters to local models when preferLocal is true', () => {
    const result = selectModel(db, { preferLocal: true })
    expect(result).not.toBeNull()
    // sonar-pro is openrouter, should not be returned
    expect(result!.modelId).not.toBe('sonar-pro')
    expect(['ollama', 'mlx']).toContain(result!.provider)
  })

  it('applies minScore threshold', () => {
    const result = selectModel(db, { minScore: 9.5 })
    expect(result).not.toBeNull()
    expect(result!.modelId).toBe('sonar-pro')
    expect(result!.score).toBeGreaterThanOrEqual(9.5)
  })

  it('returns null when minScore excludes all models', () => {
    const result = selectModel(db, { minScore: 99 })
    expect(result).toBeNull()
  })

  it('excludes specified models', () => {
    const result = selectModel(db, { excludeModels: ['sonar-pro'] })
    expect(result).not.toBeNull()
    expect(result!.modelId).not.toBe('sonar-pro')
  })

  it('maps taskType to pack correctly', () => {
    const result = selectModel(db, { taskType: 'reasoning' })
    expect(result).not.toBeNull()
    // Should only look at reasoning pack results
    expect(result!.modelId).toBe('qwen2.5:32b')
  })

  it('returns null when no data in DB', () => {
    const emptyDb = createTestDb()
    const result = selectModel(emptyDb, {})
    expect(result).toBeNull()
  })

  it('includes reason string with score info', () => {
    const result = selectModel(db, {})
    expect(result).not.toBeNull()
    expect(result!.reason).toContain('9.6')
  })

  it('combines preferLocal + packHint', () => {
    const result = selectModel(db, { preferLocal: true, packHint: 'reasoning' })
    expect(result).not.toBeNull()
    expect(['ollama', 'mlx']).toContain(result!.provider)
  })
})
