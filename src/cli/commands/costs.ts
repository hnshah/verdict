/**
 * `verdict costs` command — summarize API spend across eval runs.
 */

import chalk from 'chalk'
import { getDb, initSchema, queryCosts, parseSince } from '../../db/client.js'
import type { CostSummaryRow } from '../../db/client.js'

export interface CostsCommandOpts {
  since?: string
  by?: string
}

/** Pad/truncate a string to fixed width. */
function col(s: string, w: number): string {
  return s.slice(0, w).padEnd(w)
}

/** Format cost with 4 decimal places for precision. */
function formatCost(cost: number): string {
  if (cost === 0) return '$0.0000'
  return `$${cost.toFixed(4)}`
}

export async function costsCommand(opts: CostsCommandOpts): Promise<void> {
  // Validate --since if provided
  if (opts.since) {
    const parsed = parseSince(opts.since)
    if (!parsed) {
      console.error(chalk.red(`  Invalid --since value: ${opts.since} (use e.g. 7d, 24h, 1w)`))
      process.exit(1)
    }
  }

  let db
  try {
    db = getDb()
    initSchema(db)
  } catch (err) {
    console.error(chalk.red(`  Failed to open database: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  let rows: CostSummaryRow[] = []
  try {
    rows = queryCosts(db, {
      since: opts.since,
      groupBy: opts.by === 'model' ? 'model' : undefined,
    })
  } catch (err) {
    console.error(chalk.red(`  Query failed: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  } finally {
    db.close()
  }

  // Compute totals
  const totalRuns = rows.reduce((sum, r) => sum + r.runs, 0)
  const totalCases = rows.reduce((sum, r) => sum + r.cases, 0)
  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0)

  // Check for no data
  if (rows.length === 0 || totalCost === 0) {
    console.log()
    const label = opts.since ? ` (last ${opts.since})` : ''
    console.log(chalk.dim(`  No cost data found${label}. Local models report $0 cost.`))
    console.log()
    return
  }

  const label = opts.since ? ` (last ${opts.since})` : ''
  console.log()
  console.log(chalk.bold(`  Cost Summary${label}`))
  console.log()

  // Header
  const header = `  ${col('Model', 25)}${col('Runs', 8)}${col('Cases', 8)}${'Cost'}`
  console.log(chalk.dim(header))
  console.log(chalk.dim('  ' + '─'.repeat(50)))

  for (const row of rows) {
    console.log(
      `  ${col(row.model_id, 25)}${col(String(row.runs), 8)}${col(String(row.cases), 8)}${formatCost(row.cost)}`
    )
  }

  console.log(chalk.dim('  ' + '─'.repeat(50)))
  console.log(
    chalk.bold(`  ${col('Total', 25)}${col(String(totalRuns), 8)}${col(String(totalCases), 8)}${formatCost(totalCost)}`)
  )
  console.log()
}
