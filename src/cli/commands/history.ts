/**
 * `verdict history` command — query and display eval history from SQLite.
 */

import chalk from 'chalk'
import { getDb, initSchema, queryHistory, parseSince } from '../../db/client.js'
import type { EvalHistoryRow, HistoryOpts } from '../../db/client.js'

interface HistoryCommandOpts {
  model?: string
  pack?: string
  since?: string
  limit?: string
  sort?: string
  trend?: boolean
}

/** Unicode sparkline characters ordered by magnitude. */
const SPARK_CHARS = '▁▂▃▄▅▆▇█'

/** Generate a sparkline string from an array of scores (0-10 scale). */
export function sparkline(scores: number[]): string {
  if (scores.length === 0) return ''
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  return scores.map(s => {
    const idx = Math.round(((s - min) / range) * (SPARK_CHARS.length - 1))
    return SPARK_CHARS[idx]
  }).join('')
}

/** Pad/truncate a string to fixed width. */
function col(s: string, w: number): string {
  return s.slice(0, w).padEnd(w)
}

/** Format a date string for display. */
function formatDate(dateStr: string): string {
  return dateStr.slice(0, 10)
}

/** Format latency in ms as a human-readable string. */
function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined) return '-'
  return `${Math.round(ms)}ms`
}

/** Format cost as a dollar string. */
function formatCost(cost: number | null): string {
  if (cost === null || cost === undefined || cost === 0) return '$0.00'
  return `$${cost.toFixed(2)}`
}

export async function historyCommand(opts: HistoryCommandOpts): Promise<void> {
  let db
  try {
    db = getDb()
    initSchema(db)
  } catch (err) {
    console.error(chalk.red(`  Failed to open database: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  const historyOpts: HistoryOpts = {
    modelId: opts.model,
    pack: opts.pack,
    since: opts.since,
    limit: opts.limit ? parseInt(opts.limit, 10) : 20,
    orderBy: opts.sort === 'score' ? 'score' : 'date',
  }

  let rows: EvalHistoryRow[]
  try {
    rows = queryHistory(db, historyOpts)
  } catch (err) {
    console.error(chalk.red(`  Query failed: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  } finally {
    db.close()
  }

  if (rows.length === 0) {
    console.log()
    console.log(chalk.dim('  No eval history found. Run `verdict run` first.'))
    console.log()
    return
  }

  console.log()
  console.log(chalk.bold('  verdict history') + chalk.dim(` — last ${rows.length} runs`))
  console.log()

  // Header
  const header = `  ${col('MODEL', 25)}${col('PACK', 12)}${col('SCORE', 10)}${col('LATENCY', 10)}${col('COST', 10)}${'DATE'}`
  console.log(chalk.dim(header))
  console.log(chalk.dim('  ' + '─'.repeat(77)))

  // If --trend, group by model and compute sparklines
  if (opts.trend) {
    const modelScores: Record<string, number[]> = {}
    for (const row of rows) {
      if (!modelScores[row.model_id]) modelScores[row.model_id] = []
      modelScores[row.model_id].push(row.score)
    }

    for (const row of rows) {
      const providerSuffix = row.provider ? ` (${row.provider})` : ''
      const modelStr = `${row.model_id}${providerSuffix}`
      const scoreStr = `${row.score.toFixed(1)}/10`
      const latencyStr = formatLatency(row.avg_latency_ms)
      const costStr = formatCost(row.total_cost_usd)
      const dateStr = formatDate(row.run_at)
      const spark = sparkline(modelScores[row.model_id])

      console.log(
        `  ${col(modelStr, 25)}${col(row.pack, 12)}${col(scoreStr, 10)}${col(latencyStr, 10)}${col(costStr, 10)}${dateStr}  ${chalk.cyan(spark)}`
      )
    }
  } else {
    for (const row of rows) {
      const providerSuffix = row.provider ? ` (${row.provider})` : ''
      const modelStr = `${row.model_id}${providerSuffix}`
      const scoreStr = `${row.score.toFixed(1)}/10`
      const latencyStr = formatLatency(row.avg_latency_ms)
      const costStr = formatCost(row.total_cost_usd)
      const dateStr = formatDate(row.run_at)

      console.log(
        `  ${col(modelStr, 25)}${col(row.pack, 12)}${col(scoreStr, 10)}${col(latencyStr, 10)}${col(costStr, 10)}${dateStr}`
      )
    }
  }

  console.log()
  console.log(chalk.dim(`  ${rows.length} results`))
  console.log()
}
