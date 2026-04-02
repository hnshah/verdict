import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import type { RunResult, ModelSummary } from '../../types/index.js'

interface CompareOptions {
  output?: string
  /** Path to baseline JSON (alternative interface to positional args) */
  baseline?: string
  /** Path to current run JSON (alternative interface to positional args) */
  current?: string
  /** Regression threshold — exit 1 if any model drops by more than this (default: none) */
  threshold?: number
  /** Output format: 'text' (default) or 'json' */
  format?: string
}

// ─── Structured compare result (for --format json) ───────────────────────────

export interface CompareResult {
  baseline: { path: string; timestamp: string; cases: number }
  current: { path: string; timestamp: string; cases: number }
  models: Array<{
    model: string
    scoreBaseline: number | null
    scoreCurrent: number | null
    delta: number | null
    pctChange: number | null
    status: 'improved' | 'declined' | 'no_change' | 'new' | 'removed' | 'regression'
    regression: boolean
  }>
  summary: {
    regressionDetected: boolean
    improved: number
    declined: number
    noChange: number
    newModels: number
    removedModels: number
  }
}

export function runCompare(fileA: string, fileB: string, threshold = Infinity): CompareResult {
  function loadResult(filePath: string): RunResult {
    const full = path.resolve(filePath)
    if (!fs.existsSync(full)) throw new Error(`File not found: ${full}`)
    try {
      return JSON.parse(fs.readFileSync(full, 'utf8')) as RunResult
    } catch {
      throw new Error(`Could not parse JSON: ${full}`)
    }
  }

  const runA = loadResult(fileA)
  const runB = loadResult(fileB)
  const allModels = [...new Set([...runA.models, ...runB.models])]

  let regressionDetected = false
  let improved = 0, declined = 0, noChange = 0, newModels = 0, removedModels = 0

  const models: CompareResult['models'] = []

  for (const model of allModels) {
    const a: ModelSummary | undefined = runA.summary[model]
    const b: ModelSummary | undefined = runB.summary[model]

    if (!a && b) {
      newModels++
      models.push({ model, scoreBaseline: null, scoreCurrent: b.avg_total, delta: null, pctChange: null, status: 'new', regression: false })
    } else if (a && !b) {
      removedModels++
      models.push({ model, scoreBaseline: a.avg_total, scoreCurrent: null, delta: null, pctChange: null, status: 'removed', regression: false })
    } else if (a && b) {
      const d = +(b.avg_total - a.avg_total).toFixed(2)
      const pct = a.avg_total > 0 ? +((d / a.avg_total) * 100).toFixed(1) : 0
      const regression = d < -threshold
      if (regression) regressionDetected = true
      const status: CompareResult['models'][0]['status'] = regression ? 'regression'
        : Math.abs(d) < 0.05 ? 'no_change'
        : d > 0 ? 'improved' : 'declined'
      if (status === 'improved') improved++
      else if (status === 'declined' || status === 'regression') declined++
      else noChange++
      models.push({ model, scoreBaseline: a.avg_total, scoreCurrent: b.avg_total, delta: d, pctChange: pct, status, regression })
    }
  }

  return {
    baseline: { path: fileA, timestamp: runA.timestamp?.slice(0, 19).replace('T', ' ') ?? 'unknown', cases: runA.cases.length },
    current: { path: fileB, timestamp: runB.timestamp?.slice(0, 19).replace('T', ' ') ?? 'unknown', cases: runB.cases.length },
    models: models.sort((a, b) => (b.scoreCurrent ?? b.scoreBaseline ?? 0) - (a.scoreCurrent ?? a.scoreBaseline ?? 0)),
    summary: { regressionDetected, improved, declined, noChange, newModels, removedModels },
  }
}

function loadResult(filePath: string): RunResult {
  const full = path.resolve(filePath)
  if (!fs.existsSync(full)) throw new Error(`File not found: ${full}`)
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8')) as RunResult
  } catch {
    throw new Error(`Could not parse JSON: ${full}`)
  }
}

function delta(a: number, b: number): string {
  const d = b - a
  if (Math.abs(d) < 0.05) return chalk.dim('  —  ')
  const s = d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2)
  return d > 0 ? chalk.green(s.padStart(6)) : chalk.red(s.padStart(6))
}

function col(s: string, w: number): string {
  return s.slice(0, w).padEnd(w)
}

export async function compareCommand(fileAArg: string | undefined, fileBArg: string | undefined, opts: CompareOptions): Promise<void> {
  // Support two call styles:
  //   verdict compare <run-a> <run-b>              (positional)
  //   verdict compare --baseline <x> --current <y> (named flags, issue #104)
  const resolvedA = opts.baseline ?? fileAArg
  const resolvedB = opts.current ?? fileBArg

  if (!resolvedA || !resolvedB) {
    console.error(chalk.red('  Usage: verdict compare <run-a> <run-b>'))
    console.error(chalk.dim('     or: verdict compare --baseline <path> --current <path>'))
    process.exit(1)
  }

  // --format json: skip all console output, just print JSON result
  if (opts.format === 'json') {
    try {
      const threshold = opts.threshold ?? Infinity
      const result = runCompare(resolvedA, resolvedB, threshold)
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      if (result.summary.regressionDetected) process.exit(1)
    } catch (err) {
      process.stderr.write(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) + '\n')
      process.exit(1)
    }
    return
  }

  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' compare'))
  console.log()

  let runA: RunResult, runB: RunResult
  try {
    runA = loadResult(resolvedA)
    runB = loadResult(resolvedB)
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  const nameA = path.basename(resolvedA, '.json')
  const nameB = path.basename(resolvedB, '.json')

  console.log(`  ${chalk.bold('A:')} ${chalk.cyan(nameA)}  (${runA.timestamp.slice(0, 19).replace('T', ' ')} UTC, ${runA.cases.length} cases)`)
  console.log(`  ${chalk.bold('B:')} ${chalk.cyan(nameB)}  (${runB.timestamp.slice(0, 19).replace('T', ' ')} UTC, ${runB.cases.length} cases)`)
  console.log()

  // --- Leaderboard comparison ---
  const allModels = [...new Set([...runA.models, ...runB.models])]

  console.log(chalk.bold('  ' + '='.repeat(80)))
  console.log(chalk.bold('  Leaderboard Δ  (B − A)'))
  console.log(chalk.bold('  ' + '='.repeat(80)))
  console.log()
  console.log(chalk.dim('  ' + col('Model', 24) + col('Score A', 9) + col('Score B', 9) + col('Δ Score', 9) + col('Δ Acc', 8) + col('Δ Latency', 11) + 'Status'))
  console.log(chalk.dim('  ' + '-'.repeat(82)))

  const rows: Array<{ model: string; scoreB: number; line: string }> = []

  for (const model of allModels) {
    const a: ModelSummary | undefined = runA.summary[model]
    const b: ModelSummary | undefined = runB.summary[model]

    if (!a && !b) continue

    if (!a) {
      // New model in B
      const line = `  ${col(chalk.green('+ ' + model), 26)}${col(chalk.green(b!.avg_total.toFixed(2)), 9)}                              ${chalk.green('new')}`
      rows.push({ model, scoreB: b!.avg_total, line })
    } else if (!b) {
      // Model removed in B
      const line = `  ${col(chalk.red('- ' + model), 26)}${col(chalk.red(a.avg_total.toFixed(2)), 9)}                              ${chalk.red('removed')}`
      rows.push({ model, scoreB: -1, line })
    } else {
      const scoreA = a.avg_total
      const scoreB = b.avg_total
      const dScore = scoreB - scoreA
      const status = Math.abs(dScore) < 0.05
        ? chalk.dim('no change')
        : dScore > 0
          ? chalk.green('improved')
          : chalk.red('declined')

      const latDelta = ((b.avg_latency_ms - a.avg_latency_ms) / 1000)
      const latStr = Math.abs(latDelta) < 0.1 ? chalk.dim('  —  ') :
        latDelta > 0 ? chalk.red(`+${latDelta.toFixed(1)}s`.padStart(6)) :
        chalk.green(`${latDelta.toFixed(1)}s`.padStart(6))

      const line = `  ${col('  ' + model, 26)}${col(scoreA.toFixed(2), 9)}${col(scoreB.toFixed(2), 9)}${delta(scoreA, scoreB).padEnd(9)}${delta(a.avg_accuracy, b.avg_accuracy).padEnd(8)}${latStr.padEnd(11)}${status}`
      rows.push({ model, scoreB, line })
    }
  }

  // Sort by score in B (descending), removed models at bottom
  rows.sort((a, b) => b.scoreB - a.scoreB)
  for (const r of rows) console.log(r.line)

  console.log()

  // --- Case-level diff ---
  const commonCases = runA.cases
    .filter(ca => runB.cases.some(cb => cb.case_id === ca.case_id))
    .map(ca => ca.case_id)

  const changedCases: Array<{ caseId: string; prompt: string; model: string; scoreA: number; scoreB: number }> = []

  for (const caseId of commonCases) {
    const caseA = runA.cases.find(c => c.case_id === caseId)!
    const caseB = runB.cases.find(c => c.case_id === caseId)!
    for (const model of allModels) {
      const sA = caseA.scores[model]
      const sB = caseB.scores[model]
      if (sA && sB && Math.abs(sB.total - sA.total) >= 1.0) {
        changedCases.push({ caseId, prompt: caseA.prompt, model, scoreA: sA.total, scoreB: sB.total })
      }
    }
  }

  if (changedCases.length > 0) {
    console.log(chalk.bold('  Notable case changes  (Δ ≥ 1.0)'))
    console.log(chalk.dim('  ' + '-'.repeat(82)))
    for (const c of changedCases) {
      const arrow = c.scoreB > c.scoreA ? chalk.green('▲') : chalk.red('▼')
      console.log(
        `  ${arrow} ${chalk.dim(c.caseId.padEnd(14))} ${chalk.dim(c.model.padEnd(22))} ` +
        `${c.scoreA.toFixed(1)} → ${c.scoreB.toFixed(1)}  ${chalk.dim(c.prompt.slice(0, 45))}`
      )
    }
    console.log()
  } else {
    console.log(chalk.dim('  No individual case scores changed by ≥ 1.0'))
    console.log()
  }

  // --- Rank changes ---
  const rankA = runA.models
    .map(id => runA.summary[id])
    .filter(Boolean)
    .sort((a, b) => b.avg_total - a.avg_total)
    .map(s => s.model_id)
  const rankB = runB.models
    .map(id => runB.summary[id])
    .filter(Boolean)
    .sort((a, b) => b.avg_total - a.avg_total)
    .map(s => s.model_id)

  const rankChanges = rankA
    .filter(id => rankB.includes(id))
    .map(id => ({ id, was: rankA.indexOf(id) + 1, now: rankB.indexOf(id) + 1 }))
    .filter(r => r.was !== r.now)

  if (rankChanges.length > 0) {
    console.log(chalk.bold('  Rank changes'))
    console.log(chalk.dim('  ' + '-'.repeat(50)))
    for (const r of rankChanges) {
      const moved = r.now < r.was
      const arrow = moved ? chalk.green('↑') : chalk.red('↓')
      console.log(`  ${arrow}  ${r.id.padEnd(28)} #${r.was} → #${r.now}`)
    }
    console.log()
  }

  // --- Summary verdict ---
  const winner = rows.filter(r => r.scoreB > 0).sort((a, b) => b.scoreB - a.scoreB)[0]
  const improvedCount = rows.filter(r => {
    const a = runA.summary[r.model]
    const b = runB.summary[r.model]
    return a && b && b.avg_total > a.avg_total + 0.05
  }).length
  const declinedCount = rows.filter(r => {
    const a = runA.summary[r.model]
    const b = runB.summary[r.model]
    return a && b && b.avg_total < a.avg_total - 0.05
  }).length

  if (winner) {
    console.log(chalk.bold(`  Best in B: ${winner.model}`) + chalk.dim(` (${winner.scoreB.toFixed(2)}/10)`))
  }
  if (improvedCount > 0) console.log(chalk.green(`  ${improvedCount} model(s) improved`))
  if (declinedCount > 0) console.log(chalk.red(`  ${declinedCount} model(s) declined`))
  console.log()

  // --- Save markdown report ---
  if (opts.output) {
    const lines: string[] = [
      `# Verdict Compare: A vs B`,
      ``,
      `- **A:** ${nameA}  (${runA.timestamp.slice(0, 19).replace('T', ' ')} UTC)`,
      `- **B:** ${nameB}  (${runB.timestamp.slice(0, 19).replace('T', ' ')} UTC)`,
      ``,
      `## Leaderboard Delta`,
      ``,
      `| Model | Score A | Score B | Δ Score | Status |`,
      `|-------|---------|---------|---------|--------|`,
    ]
    for (const model of allModels) {
      const a = runA.summary[model]
      const b = runB.summary[model]
      if (!a && !b) continue
      if (!a) lines.push(`| ${model} | — | ${b!.avg_total.toFixed(2)} | — | new |`)
      else if (!b) lines.push(`| ${model} | ${a.avg_total.toFixed(2)} | — | — | removed |`)
      else {
        const d = b.avg_total - a.avg_total
        const dStr = d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2)
        const status = Math.abs(d) < 0.05 ? 'no change' : d > 0 ? 'improved' : 'declined'
        lines.push(`| ${model} | ${a.avg_total.toFixed(2)} | ${b.avg_total.toFixed(2)} | ${dStr} | ${status} |`)
      }
    }
    if (changedCases.length > 0) {
      lines.push(``, `## Notable Case Changes (Δ ≥ 1.0)`, ``)
      lines.push(`| Case | Model | Score A | Score B | Prompt |`)
      lines.push(`|------|-------|---------|---------|--------|`)
      for (const c of changedCases) {
        lines.push(`| ${c.caseId} | ${c.model} | ${c.scoreA.toFixed(1)} | ${c.scoreB.toFixed(1)} | ${c.prompt.slice(0, 60)} |`)
      }
    }
    fs.writeFileSync(opts.output, lines.join('\n') + '\n')
    console.log(chalk.dim(`  report: ${opts.output}`))
    console.log()
  }

  // --- Regression exit code (--threshold flag, issue #104) ---
  if (opts.threshold !== undefined) {
    const regressions = allModels.filter(model => {
      const a = runA.summary[model]
      const b = runB.summary[model]
      return a && b && (b.avg_total - a.avg_total) < -opts.threshold!
    })
    if (regressions.length > 0) {
      console.log(chalk.red(`  ❌ Regression detected: ${regressions.join(', ')} dropped >${opts.threshold}pts`))
      console.log()
      process.exit(1)
    }
  }
}
