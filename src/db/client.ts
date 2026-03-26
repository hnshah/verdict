/**
 * SQLite database connection and helper methods for verdict persistence.
 * Uses better-sqlite3 synchronous API for simplicity.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { ALL_SCHEMAS } from './schema.js'
import type { RunResult } from '../types/index.js'

/** Options for querying eval history. */
export interface HistoryOpts {
  modelId?: string
  pack?: string
  since?: string
  limit?: number
  orderBy?: 'score' | 'date'
}

/** A row returned from the eval history query. */
export interface EvalHistoryRow {
  run_id: string
  name: string | null
  model_id: string
  provider: string | null
  pack: string
  score: number
  max_score: number
  cases_run: number
  wins: number
  avg_latency_ms: number | null
  total_cost_usd: number | null
  tokens_per_sec: number | null
  run_at: string
}

/**
 * Opens or creates the verdict SQLite database.
 * Database location: ~/.verdict/results.db
 */
export function getDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? path.join(os.homedir(), '.verdict', 'results.db')
  const dir = path.dirname(resolvedPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const db = new Database(resolvedPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

/** Runs all CREATE TABLE IF NOT EXISTS statements. */
export function initSchema(db: Database.Database): void {
  for (const sql of ALL_SCHEMAS) {
    db.exec(sql)
  }
}

/**
 * Persists a full RunResult to the database.
 * Inserts into eval_results, question_results, and upserts models_registry.
 */
export function saveRunResult(db: Database.Database, result: RunResult, pack: string): void {
  const insertEvalResult = db.prepare(`
    INSERT INTO eval_results (run_id, name, model_id, provider, pack, score, max_score, cases_run, wins, avg_latency_ms, total_cost_usd, tokens_per_sec, run_at)
    VALUES (@run_id, @name, @model_id, @provider, @pack, @score, @max_score, @cases_run, @wins, @avg_latency_ms, @total_cost_usd, @tokens_per_sec, @run_at)
  `)

  const insertQuestionResult = db.prepare(`
    INSERT INTO question_results (eval_result_id, case_id, prompt, model_id, score, latency_ms, response, input_tokens, output_tokens)
    VALUES (@eval_result_id, @case_id, @prompt, @model_id, @score, @latency_ms, @response, @input_tokens, @output_tokens)
  `)

  const upsertModel = db.prepare(`
    INSERT INTO models_registry (model_id, provider, first_seen, last_eval_at, best_score, best_pack, total_runs)
    VALUES (@model_id, @provider, @last_eval_at, @last_eval_at, @best_score, @best_pack, 1)
    ON CONFLICT(model_id) DO UPDATE SET
      provider = COALESCE(@provider, provider),
      last_eval_at = @last_eval_at,
      best_score = MAX(COALESCE(best_score, 0), @best_score),
      best_pack = CASE WHEN @best_score > COALESCE(best_score, 0) THEN @best_pack ELSE best_pack END,
      total_runs = total_runs + 1
  `)

  const runAt = result.timestamp

  const saveAll = db.transaction(() => {
    for (const modelId of result.models) {
      const summary = result.summary[modelId]
      if (!summary) continue

      // Detect provider from model_id pattern
      const provider = detectProvider(modelId)

      // Calculate tokens/sec from case data
      let totalTokens = 0
      let totalLatencyS = 0
      for (const c of result.cases) {
        const resp = c.responses[modelId]
        if (resp && !resp.error) {
          totalTokens += resp.output_tokens
          totalLatencyS += resp.latency_ms / 1000
        }
      }
      const tokensPerSec = totalLatencyS > 0 ? totalTokens / totalLatencyS : null

      const evalInfo = insertEvalResult.run({
        run_id: result.run_id,
        name: result.name,
        model_id: modelId,
        provider,
        pack,
        score: summary.avg_total,
        max_score: 10,
        cases_run: summary.cases_run,
        wins: summary.wins,
        avg_latency_ms: summary.avg_latency_ms,
        total_cost_usd: summary.total_cost_usd,
        tokens_per_sec: tokensPerSec,
        run_at: runAt,
      })

      const evalResultId = evalInfo.lastInsertRowid

      // Insert individual question results
      for (const c of result.cases) {
        const resp = c.responses[modelId]
        const score = c.scores[modelId]
        if (!resp || !score) continue

        insertQuestionResult.run({
          eval_result_id: evalResultId,
          case_id: c.case_id,
          prompt: c.prompt,
          model_id: modelId,
          score: score.total,
          latency_ms: resp.latency_ms,
          response: resp.text,
          input_tokens: resp.input_tokens,
          output_tokens: resp.output_tokens,
        })
      }

      // Upsert models registry
      upsertModel.run({
        model_id: modelId,
        provider,
        last_eval_at: runAt,
        best_score: summary.avg_total,
        best_pack: pack,
      })
    }
  })

  saveAll()
}

/**
 * Flexible query builder for eval history.
 * Supports filtering by model, pack, date range, and sorting.
 */
export function queryHistory(db: Database.Database, opts: HistoryOpts): EvalHistoryRow[] {
  const conditions: string[] = []
  const params: Record<string, string | number> = {}

  if (opts.modelId) {
    conditions.push('model_id = @modelId')
    params.modelId = opts.modelId
  }

  if (opts.pack) {
    conditions.push('pack = @pack')
    params.pack = opts.pack
  }

  if (opts.since) {
    const sinceDate = parseSince(opts.since)
    if (sinceDate) {
      conditions.push('run_at >= @since')
      params.since = sinceDate.toISOString()
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderBy = opts.orderBy === 'score' ? 'score DESC' : 'run_at DESC'
  const limit = opts.limit ?? 20

  const sql = `SELECT run_id, name, model_id, provider, pack, score, max_score, cases_run, wins, avg_latency_ms, total_cost_usd, tokens_per_sec, run_at FROM eval_results ${where} ORDER BY ${orderBy} LIMIT @limit`
  params.limit = limit

  return db.prepare(sql).all(params) as EvalHistoryRow[]
}

/** Detect provider from model id conventions. */
function detectProvider(modelId: string): string | null {
  const lower = modelId.toLowerCase()
  if (lower.includes('ollama') || lower.includes(':')) return 'ollama'
  if (lower.includes('mlx')) return 'mlx'
  if (lower.includes('openrouter')) return 'openrouter'
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3')) return 'openai'
  if (lower.includes('claude')) return 'anthropic'
  if (lower.includes('groq')) return 'groq'
  if (lower.includes('sonar')) return 'openrouter'
  return null
}

/**
 * Parse a relative time string like "7d", "24h", "30d", "1w" into a Date.
 * Returns null if the format is not recognized.
 */
export function parseSince(since: string): Date | null {
  const match = since.match(/^(\d+)(h|d|w)$/)
  if (!match) return null

  const amount = parseInt(match[1], 10)
  const unit = match[2]
  const now = new Date()

  switch (unit) {
    case 'h':
      now.setHours(now.getHours() - amount)
      break
    case 'd':
      now.setDate(now.getDate() - amount)
      break
    case 'w':
      now.setDate(now.getDate() - amount * 7)
      break
  }

  return now
}
