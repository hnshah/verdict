import chalk from 'chalk'
import type { RunResult, BaselineComparison, SynthesisResult } from '../types/index.js'

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

  // Cost-quality frontier
  const freeModels = sorted.filter(s => s.total_cost_usd === 0 && s.cases_run > 0)
  const paidModels = sorted.filter(s => s.total_cost_usd > 0 && s.cases_run > 0)
  if (freeModels.length > 0 && paidModels.length > 0) {
    const bestFree = freeModels[0]
    const bestPaid = paidModels[0]
    const gap = +(bestPaid.avg_total - bestFree.avg_total).toFixed(1)
    console.log(chalk.bold('  Cost-quality frontier'))
    if (gap < 0.5) {
      console.log(chalk.green(`  ${bestFree.model_id} matches ${bestPaid.model_id} within ${gap}pts. Use the free model.`))
    } else {
      console.log(chalk.yellow(`  ${bestPaid.model_id} leads ${bestFree.model_id} by ${gap}pts at $${bestPaid.total_cost_usd.toFixed(4)}/run.`))
    }
    console.log()
  }

  const winner = sorted[0]
  if (winner) {
    console.log(chalk.bold(`  Winner: ${winner.model_id}`) + chalk.dim(` (${winner.avg_total}/10, ${winner.wins} wins)`))
  }
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
