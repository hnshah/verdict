/**
 * Model selector — picks the best available model for a task using eval history.
 */

import type BetterSqlite3 from 'better-sqlite3'

/** Options for model selection. */
export interface SelectorOpts {
  taskType?: string
  packHint?: string
  preferLocal?: boolean
  minScore?: number
  excludeModels?: string[]
}

/** The selected model result. */
export interface SelectedModel {
  modelId: string
  provider: string
  score: number
  reason: string
}

/** Map task types to eval pack names. */
function taskTypeToPack(taskType?: string): string | null {
  if (!taskType) return null
  const mapping: Record<string, string> = {
    reasoning: 'reasoning',
    coding: 'coding',
    summarize: 'writing-quality',
    writing: 'writing-quality',
    general: 'general',
    fast: 'general',
    instruction: 'instruction-following',
  }
  return mapping[taskType.toLowerCase()] ?? null
}

/**
 * Selects the best model for a task based on eval history.
 * Queries eval_results for best average score, optionally filtering by provider and pack.
 */
export function selectModel(db: BetterSqlite3.Database, opts: SelectorOpts): SelectedModel | null {
  const conditions: string[] = []
  const params: Record<string, string | number> = {}

  // Filter by pack if we have a hint
  const pack = opts.packHint ?? taskTypeToPack(opts.taskType)
  if (pack) {
    conditions.push('pack = @pack')
    params.pack = pack
  }

  // Filter for local models only if preferred
  if (opts.preferLocal) {
    conditions.push("(provider = 'ollama' OR provider = 'mlx')")
  }

  // Exclude specific models
  const excludes = opts.excludeModels ?? []
  if (excludes.length > 0) {
    const placeholders = excludes.map((_, i) => `@exclude${i}`)
    conditions.push(`model_id NOT IN (${placeholders.join(', ')})`)
    excludes.forEach((m, i) => { params[`exclude${i}`] = m })
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // minScore must go in HAVING since it filters on the aggregate
  const havingClauses: string[] = ['COUNT(*) >= 1']
  if (opts.minScore !== undefined) {
    havingClauses.push('AVG(score) >= @minScore')
    params.minScore = opts.minScore
  }
  const having = `HAVING ${havingClauses.join(' AND ')}`

  const sql = `
    SELECT model_id, provider, AVG(score) as avg_score, COUNT(*) as run_count
    FROM eval_results
    ${where}
    GROUP BY model_id
    ${having}
    ORDER BY avg_score DESC
    LIMIT 1
  `

  const row = db.prepare(sql).get(params) as { model_id: string; provider: string; avg_score: number; run_count: number } | undefined

  if (!row) return null

  const packInfo = pack ? ` on ${pack}` : ''
  const localInfo = opts.preferLocal ? ', local preferred' : ''
  const reason = `Best avg score ${row.avg_score.toFixed(1)}/10${packInfo} (${row.run_count} runs${localInfo})`

  return {
    modelId: row.model_id,
    provider: row.provider ?? 'unknown',
    score: row.avg_score,
    reason,
  }
}
