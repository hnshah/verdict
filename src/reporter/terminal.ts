import chalk from 'chalk'
import type { RunResult, BaselineComparison, SynthesisResult } from '../types/index.js'

/**
 * Deterministic, always-on headline verdict computed from the leaderboard.
 *
 * Levels:
 *   CLEAR        — top model leads #2 by ≥ 0.5pts (high confidence)
 *   LEAN         — top model leads #2 by 0.2–0.5pts (probable)
 *   INCONCLUSIVE — top model leads #2 by < 0.2pts (within noise)
 *
 * The cost-quality callout is the second-loudest signal: if a free model
 * matches the best paid within 0.5pts, that's the recommendation regardless
 * of who "won" by absolute score.
 */
export function printVerdict(result: RunResult): void {
  const sorted = result.models
    .map(id => result.summary[id])
    .filter(s => s && s.cases_run > 0)
    .sort((a, b) => b.avg_total - a.avg_total)

  if (sorted.length === 0) {
    console.log()
    console.log(chalk.bold('  VERDICT'))
    console.log(chalk.red('  No models produced results.'))
    console.log()
    return
  }

  const top = sorted[0]
  const second = sorted[1]
  const gap = second ? +(top.avg_total - second.avg_total).toFixed(2) : Infinity

  let level: 'CLEAR' | 'LEAN' | 'INCONCLUSIVE'
  if (!second) level = 'CLEAR'
  else if (gap >= 0.5) level = 'CLEAR'
  else if (gap >= 0.2) level = 'LEAN'
  else level = 'INCONCLUSIVE'

  const levelColor =
    level === 'CLEAR' ? chalk.green :
    level === 'LEAN' ? chalk.yellow :
    chalk.red

  console.log()
  console.log(chalk.bold('  ┌' + '─'.repeat(78) + '┐'))
  console.log(
    chalk.bold('  │  ') +
    chalk.bold('VERDICT: ') + levelColor.bold(level.padEnd(13)) +
    chalk.bold('WINNER: ') + chalk.cyan.bold(top.model_id) +
    chalk.dim(`  ${top.avg_total.toFixed(1)}/10`)
  )

  // Cost-quality callout
  const freeModels = sorted.filter(s => s.total_cost_usd === 0)
  const paidModels = sorted.filter(s => s.total_cost_usd > 0)
  if (freeModels.length > 0 && paidModels.length > 0) {
    const bestFree = freeModels[0]
    const bestPaid = paidModels[0]
    const freeGap = +(bestPaid.avg_total - bestFree.avg_total).toFixed(2)
    if (freeGap < 0.5 && bestPaid.total_cost_usd > 0) {
      const perRun = bestPaid.total_cost_usd
      const monthly500 = (perRun * 500).toFixed(2)
      console.log(
        chalk.bold('  │  ') +
        chalk.green(`→ ${bestFree.model_id} matches ${bestPaid.model_id} within ${freeGap}pts. Use local, save ~$${monthly500}/mo at 500 runs.`)
      )
    } else if (freeGap >= 0.5) {
      console.log(
        chalk.bold('  │  ') +
        chalk.yellow(`→ ${bestPaid.model_id} leads ${bestFree.model_id} by ${freeGap}pts (paid edge real)`)
      )
    }
  }

  // Gap detail
  if (second && level !== 'CLEAR') {
    console.log(
      chalk.bold('  │  ') +
      chalk.dim(`  Gap vs #2 (${second.model_id}): ${gap >= 0 ? '+' : ''}${gap.toFixed(2)}pts — ${level === 'LEAN' ? 'probable winner' : 'within noise'}`)
    )
  }
  console.log(chalk.bold('  └' + '─'.repeat(78) + '┘'))
  console.log()
}

export function printSummary(result: RunResult): void {
  const sorted = result.models
    .map(id => result.summary[id])
    .filter(Boolean)
    .sort((a, b) => b.avg_total - a.avg_total)

  console.log()
  console.log(chalk.bold('  ' + '='.repeat(80)))
  console.log(chalk.bold(`  ${result.name}`))
  console.log(chalk.dim(`  ${result.timestamp.slice(0, 19).replace('T', ' ')} UTC | ${result.cases.length} cases`))
  console.log(chalk.bold('  ' + '='.repeat(80)))
  console.log()

  const col = (s: string, w: number) => s.slice(0, w).padEnd(w)
  console.log(chalk.dim(
    '  ' + col('Model', 22) + col('Score', 8) + col('Acc', 7) + col('Comp', 7) +
    col('Conc', 7) + col('Latency', 10) + col('Cost', 10) + 'Win%'
  ))
  console.log(chalk.dim('  ' + '-'.repeat(82)))

  sorted.forEach((s, i) => {
    const medal = i === 0 ? chalk.yellow('  [1]') : i === 1 ? '  [2]' : i === 2 ? '  [3]' : `  [${i+1}]`
    const score = s.avg_total >= 8 ? chalk.green(s.avg_total.toFixed(1)) :
                  s.avg_total >= 6 ? chalk.yellow(s.avg_total.toFixed(1)) :
                  chalk.red(s.avg_total.toFixed(1))
    const latency = s.avg_latency_ms < 2000 ? chalk.green(`${(s.avg_latency_ms/1000).toFixed(1)}s`) :
                    s.avg_latency_ms < 8000 ? chalk.yellow(`${(s.avg_latency_ms/1000).toFixed(1)}s`) :
                    chalk.red(`${(s.avg_latency_ms/1000).toFixed(1)}s`)
    const cost = s.total_cost_usd > 0
      ? chalk.dim(`$${s.total_cost_usd.toFixed(4)}`)
      : chalk.green('free')
    const wr = s.win_rate > 50 ? chalk.green(`${s.win_rate.toFixed(0)}%`) : chalk.dim(`${s.win_rate.toFixed(0)}%`)

    console.log(
      `${medal} ${col(s.model_id, 20)} ${col(score, 8)}` +
      `${col(chalk.dim(s.avg_accuracy.toFixed(1)), 7)}${col(chalk.dim(s.avg_completeness.toFixed(1)), 7)}` +
      `${col(chalk.dim(s.avg_conciseness.toFixed(1)), 7)}${col(latency, 10)}${col(cost, 10)}${wr}`
    )
  })

  console.log()
}

export function printCaseDetail(
  caseId: string, prompt: string,
  scores: Record<string, { total: number; reasoning: string; confidence?: number }>
): void {
  console.log(chalk.dim(`\n  [${caseId}] ${prompt.slice(0, 72)}${prompt.length > 72 ? '...' : ''}`))
  for (const [id, score] of Object.entries(scores)) {
    // Clamp score to 0-10 range to prevent negative repeat counts
    const scoreDisplay = Math.max(0, Math.min(10, Math.round(score.total)))
    const bar = '|'.repeat(scoreDisplay) + chalk.dim('.'.repeat(10 - scoreDisplay))
    const lowConfidence = score.confidence !== undefined && score.confidence < 4
      ? chalk.yellow(' ⚠ low confidence')
      : ''
    console.log(`    ${chalk.dim(id.padEnd(22))} ${bar} ${score.total.toFixed(1)}  ${chalk.dim(score.reasoning.slice(0, 60))}${lowConfidence}`)
  }
}

export function printBaselineComparison(comparison: BaselineComparison): void {
  console.log()
  console.log(chalk.bold(`  Baseline comparison (vs "${comparison.baselineName}")`))
  console.log(chalk.dim(`  Baseline date: ${comparison.baselineDate}`))
  console.log(chalk.dim('  ' + '-'.repeat(60)))

  for (const d of comparison.deltas) {
    const arrow = d.delta > 0 ? chalk.green('↑') : d.delta < 0 ? chalk.red('↓') : chalk.dim('—')
    const deltaStr = d.delta > 0 ? chalk.green(`+${d.delta.toFixed(2)}`) : d.delta < 0 ? chalk.red(d.delta.toFixed(2)) : chalk.dim('0.00')
    const pct = d.pctChange > 0 ? chalk.green(`+${d.pctChange.toFixed(1)}%`) : d.pctChange < 0 ? chalk.red(`${d.pctChange.toFixed(1)}%`) : chalk.dim('0.0%')
    const warn = d.regression ? chalk.red(' ⚠️  REGRESSION') : ''
    console.log(`  ${arrow} ${d.model.padEnd(22)} ${d.scoreA.toFixed(2)} → ${d.scoreB.toFixed(2)}  ${deltaStr} (${pct})${warn}`)
  }

  for (const m of comparison.newModels) {
    console.log(`  ${chalk.green('+')} ${m.padEnd(22)} ${chalk.green('new')}`)
  }
  for (const m of comparison.removedModels) {
    console.log(`  ${chalk.red('-')} ${m.padEnd(22)} ${chalk.red('removed')}`)
  }

  if (comparison.regressionAlert) {
    console.log()
    console.log(chalk.red.bold('  ⚠️  REGRESSION ALERT: One or more models dropped > 0.5pts vs baseline'))
  }
  console.log()
}

export function printSynthesis(synthesis: SynthesisResult): void {
  console.log()
  console.log(chalk.bold('  Synthesis'))
  console.log(chalk.dim('  ' + '-'.repeat(60)))
  const verdictColor = synthesis.verdict === 'CLEAR' ? chalk.green : synthesis.verdict === 'LEAN' ? chalk.yellow : chalk.red
  console.log(`  ${chalk.bold('Verdict:')}        ${verdictColor(synthesis.verdict)}`)
  console.log(`  ${chalk.bold('Confidence:')}     ${synthesis.confidence}`)
  console.log(`  ${chalk.bold('Recommendation:')} ${synthesis.recommendation}`)
  console.log(`  ${chalk.bold('Key finding:')}    ${synthesis.keyFinding}`)
  console.log(`  ${chalk.bold('Caveats:')}        ${chalk.dim(synthesis.caveats)}`)
  console.log()
}
