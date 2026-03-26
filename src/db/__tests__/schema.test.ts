import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema } from '../client.js'

describe('schema', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  })

  it('creates all three tables', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all() as Array<{ name: string }>

    const names = tables.map(t => t.name)
    expect(names).toContain('eval_results')
    expect(names).toContain('question_results')
    expect(names).toContain('models_registry')
  })

  it('eval_results has correct columns', () => {
    const cols = db.prepare('PRAGMA table_info(eval_results)').all() as Array<{ name: string; type: string }>
    const colNames = cols.map(c => c.name)
    expect(colNames).toEqual(expect.arrayContaining([
      'id', 'run_id', 'name', 'model_id', 'provider', 'pack',
      'score', 'max_score', 'cases_run', 'wins', 'avg_latency_ms',
      'total_cost_usd', 'tokens_per_sec', 'run_at',
    ]))
  })

  it('question_results has correct columns', () => {
    const cols = db.prepare('PRAGMA table_info(question_results)').all() as Array<{ name: string }>
    const colNames = cols.map(c => c.name)
    expect(colNames).toEqual(expect.arrayContaining([
      'id', 'eval_result_id', 'case_id', 'prompt', 'model_id',
      'score', 'latency_ms', 'response', 'input_tokens', 'output_tokens',
    ]))
  })

  it('models_registry has correct columns', () => {
    const cols = db.prepare('PRAGMA table_info(models_registry)').all() as Array<{ name: string }>
    const colNames = cols.map(c => c.name)
    expect(colNames).toEqual(expect.arrayContaining([
      'id', 'model_id', 'provider', 'first_seen', 'last_eval_at',
      'best_score', 'best_pack', 'avg_tokens_per_sec', 'total_runs',
    ]))
  })

  it('enforces UNIQUE constraint on models_registry.model_id', () => {
    db.prepare("INSERT INTO models_registry (model_id, provider) VALUES ('test-model', 'ollama')").run()
    expect(() => {
      db.prepare("INSERT INTO models_registry (model_id, provider) VALUES ('test-model', 'mlx')").run()
    }).toThrow(/UNIQUE constraint/)
  })

  it('enforces foreign key constraint: question_results → eval_results', () => {
    expect(() => {
      db.prepare(
        "INSERT INTO question_results (eval_result_id, case_id, model_id, score) VALUES (9999, 'case-1', 'model-1', 8.5)"
      ).run()
    }).toThrow(/FOREIGN KEY/)
  })

  it('cascade deletes question_results when eval_results row is deleted', () => {
    const info = db.prepare(
      "INSERT INTO eval_results (run_id, model_id, pack, score, cases_run, run_at) VALUES ('run-1', 'model-1', 'general', 9.0, 1, '2026-03-25T12:00:00Z')"
    ).run()
    const evalId = info.lastInsertRowid

    db.prepare(
      "INSERT INTO question_results (eval_result_id, case_id, model_id, score) VALUES (?, 'case-1', 'model-1', 9.0)"
    ).run(evalId)

    const before = db.prepare('SELECT COUNT(*) as count FROM question_results').get() as { count: number }
    expect(before.count).toBe(1)

    db.prepare('DELETE FROM eval_results WHERE id = ?').run(evalId)

    const after = db.prepare('SELECT COUNT(*) as count FROM question_results').get() as { count: number }
    expect(after.count).toBe(0)
  })

  it('is idempotent — running initSchema twice does not error', () => {
    expect(() => initSchema(db)).not.toThrow()
  })
})
