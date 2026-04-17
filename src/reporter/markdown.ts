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
    // Check if any score has confidence data
    const hasConfidence = Object.values(c.scores).some(s => s.confidence != null)
    if (hasConfidence) {
      lines.push(`| Model | Score | Confidence | Reasoning |`, `|-------|-------|------------|-----------|`)
      for (const [id, score] of Object.entries(c.scores)) {
        const confStr = score.confidence != null
          ? (score.confidence < 4 ? `⚠ ${score.confidence}/10` : `${score.confidence}/10`)
          : '—'
        lines.push(`| ${id} | ${score.total} | ${confStr} | ${score.reasoning} |`)
      }
    } else {
      lines.push(`| Model | Score | Reasoning |`, `|-------|-------|-----------|`)
      for (const [id, score] of Object.entries(c.scores)) {
        lines.push(`| ${id} | ${score.total} | ${score.reasoning} |`)
      }
    }
    lines.push(``)
  }

  return lines.join('\n')
}
