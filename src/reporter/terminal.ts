import chalk from 'chalk'
import type { RunResult } from '../types/index.js'

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
  scores: Record<string, { total: number; reasoning: string }>
): void {
  console.log(chalk.dim(`\n  [${caseId}] ${prompt.slice(0, 72)}${prompt.length > 72 ? '...' : ''}`))
  for (const [id, score] of Object.entries(scores)) {
    const bar = '|'.repeat(Math.round(score.total)) + chalk.dim('.'.repeat(10 - Math.round(score.total)))
    console.log(`    ${chalk.dim(id.padEnd(22))} ${bar} ${score.total.toFixed(1)}  ${chalk.dim(score.reasoning.slice(0, 60))}`)
  }
}
