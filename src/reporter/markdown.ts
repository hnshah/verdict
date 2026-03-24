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
