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

/** Data for inserting a new job. */
export interface JobInsert {
  type: string
  model_id?: string
  input?: string
  priority?: number
  metadata?: string
}

/** A row from the jobs table. */
export interface JobRow {
  id: number
  type: string
  status: string
  model_id: string | null
  input: string | null
  output: string | null
  error: string | null
  priority: number
  queued_at: string
  started_at: string | null
  completed_at: string | null
  metadata: string | null
}

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

/** A per-case result row used by the dashboard drill-in. */
export interface CaseResultRow {
  case_id: string
  model_id: string
  score: number
  latency_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  prompt: string | null
  response: string | null
}

/**
 * Per-case results for a given run. If `modelId` is provided, restrict to
 * that model's rows; otherwise return all models for the run.
 */
export function queryCaseResults(db: Database.Database, runId: string, modelId?: string): CaseResultRow[] {
  const params: Record<string, string> = { runId }
  let extra = ''
  if (modelId) {
    extra = ' AND qr.model_id = @modelId'
    params.modelId = modelId
  }
  const sql = `
    SELECT qr.case_id, qr.model_id, qr.score, qr.latency_ms,
           qr.input_tokens, qr.output_tokens, qr.prompt, qr.response
    FROM question_results qr
    JOIN eval_results er ON er.id = qr.eval_result_id
    WHERE er.run_id = @runId${extra}
    ORDER BY qr.id ASC
  `
  return db.prepare(sql).all(params) as CaseResultRow[]
}

/** A row in the aggregated leaderboard. */
export interface LeaderboardRow {
  model_id: string
  provider: string | null
  avg_score: number
  runs: number
  last_score: number
  delta: number
  trend: number[]
  avg_cost_usd: number
  avg_latency_ms: number
}

/**
 * Aggregate top-N models across the last `windowRuns` rows in eval_results,
 * sorted by avg_score desc. Returns trend (last 8 scores chronologically)
 * and delta (last - previous).
 */
export function queryLeaderboard(
  db: Database.Database,
  opts: { limit?: number; windowRuns?: number } = {},
): LeaderboardRow[] {
  const limit = opts.limit ?? 10
  const windowRuns = opts.windowRuns ?? 25

  // Pull a window of recent rows (newest first) — large enough to compute trends.
  const sql = `
    SELECT model_id, provider, score, total_cost_usd, avg_latency_ms, run_at
    FROM eval_results
    ORDER BY run_at DESC
    LIMIT @cap
  `
  const cap = Math.max(windowRuns * limit, 200)
  const rows = db.prepare(sql).all({ cap }) as Array<{
    model_id: string
    provider: string | null
    score: number
    total_cost_usd: number | null
    avg_latency_ms: number | null
    run_at: string
  }>

  // Group by model_id, oldest → newest order (for trend chronology).
  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    let g = groups.get(r.model_id)
    if (!g) { g = []; groups.set(r.model_id, g) }
    g.push(r)
  }

  const aggregated: LeaderboardRow[] = []
  for (const [modelId, list] of groups) {
    // list is currently newest → oldest. Reverse for chronological trend.
    const chrono = [...list].reverse()
    const recent = chrono.slice(-windowRuns)
    const scores = recent.map(r => r.score)
    const avg = scores.reduce((s, v) => s + v, 0) / Math.max(1, scores.length)
    const last = scores[scores.length - 1] ?? 0
    const prev = scores.length >= 2 ? scores[scores.length - 2] : last
    const cost = recent.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0) / Math.max(1, recent.length)
    const lat = recent.reduce((s, r) => s + (r.avg_latency_ms ?? 0), 0) / Math.max(1, recent.length)
    aggregated.push({
      model_id: modelId,
      provider: recent[recent.length - 1]?.provider ?? null,
      avg_score: Number(avg.toFixed(2)),
      runs: scores.length,
      last_score: last,
      delta: Number((last - prev).toFixed(2)),
      trend: scores.slice(-8),
      avg_cost_usd: Number(cost.toFixed(4)),
      avg_latency_ms: Math.round(lat),
    })
  }

  aggregated.sort((a, b) => b.avg_score - a.avg_score)
  return aggregated.slice(0, limit)
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

/** Inserts a job into the queue and returns its id. */
export function addJob(db: Database.Database, job: JobInsert): number {
  const stmt = db.prepare(`
    INSERT INTO jobs (type, model_id, input, priority, metadata)
    VALUES (@type, @model_id, @input, @priority, @metadata)
  `)
  const info = stmt.run({
    type: job.type,
    model_id: job.model_id ?? null,
    input: job.input ?? null,
    priority: job.priority ?? 0,
    metadata: job.metadata ?? null,
  })
  return Number(info.lastInsertRowid)
}

/** Updates fields on an existing job. */
export function updateJob(db: Database.Database, id: number, update: Partial<JobRow>): void {
  const fields: string[] = []
  const params: Record<string, unknown> = { id }

  for (const key of ['status', 'model_id', 'output', 'error', 'started_at', 'completed_at', 'metadata'] as const) {
    if (key in update) {
      fields.push(`${key} = @${key}`)
      params[key] = update[key]
    }
  }

  if (fields.length === 0) return

  db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = @id`).run(params)
}

/** Picks the next queued job by priority desc, then queued_at asc. Returns null if queue is empty. */
export function getNextJob(db: Database.Database): JobRow | null {
  return (db.prepare(
    `SELECT * FROM jobs WHERE status = 'queued' ORDER BY priority DESC, queued_at ASC LIMIT 1`
  ).get() as JobRow | undefined) ?? null
}

/** Query jobs with optional status filter and limit. */
export function getJobs(db: Database.Database, opts: { status?: string; limit?: number } = {}): JobRow[] {
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (opts.status) {
    conditions.push('status = @status')
    params.status = opts.status
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 50
  params.limit = limit

  return db.prepare(
    `SELECT * FROM jobs ${where} ORDER BY queued_at DESC LIMIT @limit`
  ).all(params) as JobRow[]
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
