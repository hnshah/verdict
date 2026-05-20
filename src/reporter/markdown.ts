import type { RunResult } from '../types/index.js'

export function generateMarkdownReport(result: RunResult): string {
  const sorted = result.models
    .map(id => result.summary[id])
    .filter(Boolean)
    .sort((a, b) => b.avg_total - a.avg_total)

  const lines: string[] = [
    `# ${result.name}`,
    ``,
    `**Run:** ${result.run_id}`,
    `**Date:** ${result.timestamp.slice(0, 19).replace('T', ' ')} UTC`,
    `**Cases:** ${result.cases.length} | **Models:** ${result.models.join(', ')}`,
    ``,
    `## Leaderboard`,
    ``,
    `| Rank | Model | Score | Accuracy | Complete | Concise | Latency | Cost | Win% |`,
    `|------|-------|-------|----------|----------|---------|---------|------|------|`,
  ]

  sorted.forEach((s, i) => {
    const cost = s.total_cost_usd > 0 ? `$${s.total_cost_usd.toFixed(4)}` : 'free'
    lines.push(
      `| ${i+1} | ${s.model_id} | **${s.avg_total}** | ${s.avg_accuracy} | ` +
      `${s.avg_completeness} | ${s.avg_conciseness} | ${(s.avg_latency_ms/1000).toFixed(1)}s | ${cost} | ${s.win_rate}% |`
    )
  })

  // Synthesis section
  if (result.synthesis) {
    const s = result.synthesis
    lines.push(``, `## Synthesis`, ``)
    lines.push(`| Field | Value |`)
    lines.push(`|-------|-------|`)
    lines.push(`| Verdict | **${s.verdict}** |`)
    lines.push(`| Confidence | ${s.confidence} |`)
    lines.push(`| Recommendation | ${s.recommendation} |`)
    lines.push(`| Key Finding | ${s.keyFinding} |`)
    lines.push(`| Caveats | ${s.caveats} |`)
  }

  // Baseline comparison section
  if (result.baselineComparison) {
    const bc = result.baselineComparison
    lines.push(``, `## Baseline Comparison (vs "${bc.baselineName}")`, ``)
    lines.push(`Baseline date: ${bc.baselineDate}`, ``)
    lines.push(`| Model | Baseline | Current | Delta | Change | Status |`)
    lines.push(`|-------|----------|---------|-------|--------|--------|`)
    for (const d of bc.deltas) {
      const deltaStr = d.delta > 0 ? `+${d.delta.toFixed(2)}` : d.delta.toFixed(2)
      const pctStr = d.pctChange > 0 ? `+${d.pctChange.toFixed(1)}%` : `${d.pctChange.toFixed(1)}%`
      const status = d.regression ? '⚠️ REGRESSION' : d.delta > 0 ? 'improved' : d.delta < 0 ? 'declined' : 'no change'
      lines.push(`| ${d.model} | ${d.scoreA.toFixed(2)} | ${d.scoreB.toFixed(2)} | ${deltaStr} | ${pctStr} | ${status} |`)
    }
    for (const m of bc.newModels) lines.push(`| ${m} | — | — | — | — | new |`)
    for (const m of bc.removedModels) lines.push(`| ${m} | — | — | — | — | removed |`)
    if (bc.regressionAlert) {
      lines.push(``, `> ⚠️ **REGRESSION ALERT**: One or more models dropped > 0.5pts vs baseline`)
    }
  }

  lines.push(``, `## Cases`, ``)
  for (const c of result.cases) {
    lines.push(`### ${c.case_id}`, ``, `> ${c.prompt}`, ``)
    lines.push(`| Model | Score | Reasoning |`, `|-------|-------|-----------|`)
    for (const [id, score] of Object.entries(c.scores)) {
      lines.push(`| ${id} | ${score.total} | ${score.reasoning} |`)
    }
    lines.push(``)
  }

  return lines.join('\n')
}

/**
 * Compact PR-comment-ready markdown. One leaderboard table, the headline
 * verdict, and a regression callout if any. Designed to fit a GitHub
 * sticky comment with the marker so the action can update it across pushes.
 */
export function generatePrCommentMarkdown(result: RunResult): string {
  const sorted = result.models
    .map(id => result.summary[id])
    .filter(s => s && s.cases_run > 0)
    .sort((a, b) => b.avg_total - a.avg_total)

  const lines: string[] = ['<!-- verdict-pr-comment -->']

  // Header
  const winner = sorted[0]
  const second = sorted[1]
  const gap = second ? +(winner.avg_total - second.avg_total).toFixed(2) : Infinity
  let level = 'CLEAR'
  if (second) {
    if (gap >= 0.5) level = 'CLEAR'
    else if (gap >= 0.2) level = 'LEAN'
    else level = 'INCONCLUSIVE'
  }
  const badge =
    level === 'CLEAR' ? '🟢' :
    level === 'LEAN' ? '🟡' :
    '🔴'

  lines.push(`### ${badge} Verdict: ${level} — winner **\`${winner?.model_id ?? 'n/a'}\`** (${winner?.avg_total?.toFixed(2) ?? '0'}/10)`)
  lines.push('')

  // Cost-quality callout
  const freeModels = sorted.filter(s => s.total_cost_usd === 0)
  const paidModels = sorted.filter(s => s.total_cost_usd > 0)
  if (freeModels.length > 0 && paidModels.length > 0) {
    const bestFree = freeModels[0]
    const bestPaid = paidModels[0]
    const fg = +(bestPaid.avg_total - bestFree.avg_total).toFixed(2)
    if (fg < 0.5) {
      lines.push(`> 💰 \`${bestFree.model_id}\` matches \`${bestPaid.model_id}\` within ${fg}pts. **Use local, save ~$${(bestPaid.total_cost_usd * 500).toFixed(2)}/mo @ 500 runs.**`)
      lines.push('')
    }
  }

  // Regression callout
  if (result.baselineComparison?.regressionAlert) {
    const bc = result.baselineComparison
    const regressed = bc.deltas.filter(d => d.regression).map(d => `\`${d.model}\` (${d.delta.toFixed(2)})`).join(', ')
    lines.push(`> ⚠️ **REGRESSION** vs baseline \`${bc.baselineName}\`: ${regressed}`)
    lines.push('')
  }

  // Leaderboard
  lines.push(`| Rank | Model | Score | Latency | Cost |`)
  lines.push(`|------|-------|------:|--------:|-----:|`)
  sorted.forEach((s, i) => {
    const cost = s.total_cost_usd > 0 ? `$${s.total_cost_usd.toFixed(4)}` : 'free'
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
    lines.push(`| ${medal} | \`${s.model_id}\` | **${s.avg_total.toFixed(2)}** | ${(s.avg_latency_ms / 1000).toFixed(1)}s | ${cost} |`)
  })

  // Baseline section (compact)
  if (result.baselineComparison && !result.baselineComparison.regressionAlert) {
    lines.push('')
    lines.push(`<sub>vs baseline \`${result.baselineComparison.baselineName}\` from ${result.baselineComparison.baselineDate}</sub>`)
  }

  lines.push('')
  lines.push(`<sub>Run ${result.run_id} · ${result.cases.length} cases · ${result.models.length} models · [verdict](https://github.com/hnshah/verdict)</sub>`)

  return lines.join('\n')
}
