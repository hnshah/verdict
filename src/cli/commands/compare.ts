import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import type { RunResult, ModelSummary } from '../../types/index.js'

interface CompareOptions {
  output?: string
  baseline?: string
  current?: string
  threshold?: number
  format?: 'terminal' | 'json'
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

export async function compareCommand(fileA: string, fileB: string, opts: CompareOptions): Promise<void> {
  // Support --baseline / --current flags
  const pathA = opts.baseline || fileA
  const pathB = opts.current || fileB
  const threshold = opts.threshold ?? 0.5
  const format = opts.format || 'terminal'

  let runA: RunResult, runB: RunResult
  try {
    runA = loadResult(pathA)
    runB = loadResult(pathB)
  } catch (err) {
    if (format === 'json') {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
    } else {
      console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    }
    process.exit(1)
  }

  if (format === 'terminal') {
    console.log()
    console.log(chalk.bold('  verdict') + chalk.dim(' compare'))
    console.log()
  }

  const nameA = path.basename(fileA, '.json')
  const nameB = path.basename(fileB, '.json')

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
    if (format === 'terminal') {
      console.log(chalk.dim(`  report: ${opts.output}`))
      console.log()
    }
  }

  // --- Regression detection ---
  const regressions = allModels
    .map(model => {
      const a = runA.summary[model]
      const b = runB.summary[model]
      if (!a || !b) return null
      const delta = b.avg_total - a.avg_total
      if (delta < -threshold) {
        return { model, baseline: a.avg_total, current: b.avg_total, delta }
      }
      return null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  // --- JSON output ---
  if (format === 'json') {
    const jsonOutput = {
      baseline: { name: nameA, timestamp: runA.timestamp, cases: runA.cases.length },
      current: { name: nameB, timestamp: runB.timestamp, cases: runB.cases.length },
      threshold,
      models: allModels.map(model => {
        const a = runA.summary[model]
        const b = runB.summary[model]
        return {
          model,
          baseline_score: a?.avg_total ?? null,
          current_score: b?.avg_total ?? null,
          delta: a && b ? b.avg_total - a.avg_total : null,
          status: !a ? 'new' : !b ? 'removed' :
            Math.abs(b.avg_total - a.avg_total) < 0.05 ? 'no_change' :
            b.avg_total > a.avg_total ? 'improved' : 'declined',
          regression: a && b && (b.avg_total - a.avg_total) < -threshold
        }
      }),
      regressions: regressions.length > 0,
      regression_details: regressions
    }
    console.log(JSON.stringify(jsonOutput, null, 2))
  }

  // --- Terminal regression report ---
  if (format === 'terminal' && regressions.length > 0) {
    console.log(chalk.bold.red('  ⚠️  Regressions detected'))
    console.log(chalk.dim('  ' + '-'.repeat(60)))
    for (const r of regressions) {
      console.log(`  ${chalk.red('▼')} ${r.model.padEnd(24)} ${r.baseline.toFixed(2)} → ${r.current.toFixed(2)}  (${r.delta.toFixed(2)})`)
    }
    console.log()
    console.log(chalk.red(`  ❌ ${regressions.length} model(s) regressed beyond threshold (${threshold})`))
    console.log()
  }

  // --- Exit code ---
  if (regressions.length > 0) {
    process.exit(1)
  }
}
