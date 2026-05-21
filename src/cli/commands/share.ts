/**
 * `verdict share <result.json>` — produce a single self-contained HTML
 * snapshot that you can drop into any static host (GitHub Pages, S3,
 * Vercel, Netlify, R2…) and share with a URL.
 *
 * Design choices:
 * - **No backend.** Verdict doesn't operate infrastructure. The output is
 *   a portable HTML file; hosting is your call.
 * - **Redacted by default.** API keys, base_url hostnames, and host fields
 *   are stripped before rendering. The reader sees model ids + scores +
 *   costs — not credentials.
 * - **Receipt-aware.** If `<base>-receipt.json` exists alongside the result,
 *   the share page includes the receipt's hashes + repro_command so
 *   recipients can verify or reproduce the run.
 */

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import type { RunResult, ModelSummary } from '../../types/index.js'
import type { ReproReceipt } from '../../core/receipt.js'

interface ShareOptions {
  out?: string
  open?: boolean   // future: open in browser; not implemented in this PR
}

/** Strip credentials + hostnames from a model config before exposing it. */
function redactModelMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out = { ...meta }
  delete out.api_key
  delete out.base_url
  delete out.host
  delete out.gateway_url
  delete out.gateway_token
  return out
}

/** Strip the parts of a receipt that could leak deployment details. */
function redactReceipt(receipt: ReproReceipt): ReproReceipt {
  return {
    ...receipt,
    models: receipt.models.map(m => ({
      ...m,
      base_url: undefined, // redact: localhost / private endpoints
    })),
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Render the share HTML. Inline everything — single self-contained file. */
export function renderShareHtml(args: {
  result: RunResult
  receipt: ReproReceipt | null
}): string {
  const { result, receipt } = args
  const safeRedactedReceipt = receipt ? redactReceipt(receipt) : null

  // Sort models by score desc; flatten summary for rendering.
  const summary = result.summary || {}
  const rows = Object.values(summary).sort((a, b) => b.avg_total - a.avg_total)
  const winner = rows[0]
  const free = rows.find(r => r.total_cost_usd === 0)
  const cheapest = [...rows].sort((a, b) => a.total_cost_usd - b.total_cost_usd)[0]

  const synthesisText = result.synthesis
    ? `${result.synthesis.verdict ?? ''} — ${result.synthesis.recommendation ?? ''}`
    : ''

  const tableRows = rows.map((m, i) => `
    <tr class="${i === 0 ? 'winner' : ''}">
      <td class="rank">${i + 1}</td>
      <td><code>${escapeHtml(m.model_id)}</code></td>
      <td class="num">${m.avg_total.toFixed(2)}</td>
      <td class="num">${(m.avg_latency_ms / 1000).toFixed(1)}s</td>
      <td class="num">${m.total_cost_usd > 0 ? '$' + m.total_cost_usd.toFixed(4) : '<span class="free">free</span>'}</td>
      <td class="num">${m.wins}</td>
    </tr>
  `).join('\n')

  const receiptBlock = safeRedactedReceipt ? `
    <section class="receipt">
      <h3>Reproducibility receipt</h3>
      <dl>
        <dt>verdict version</dt><dd>v${escapeHtml(safeRedactedReceipt.verdict_version)}</dd>
        <dt>config hash</dt>    <dd><code>${escapeHtml(safeRedactedReceipt.hashes.config)}</code></dd>
        <dt>dataset hash</dt>   <dd><code>${escapeHtml(safeRedactedReceipt.hashes.dataset)}</code></dd>
        <dt>judge hash</dt>     <dd><code>${escapeHtml(safeRedactedReceipt.hashes.judge)}</code></dd>
        <dt>hardware</dt>       <dd>${escapeHtml(safeRedactedReceipt.hardware.platform)} ${escapeHtml(safeRedactedReceipt.hardware.arch)} · ${safeRedactedReceipt.hardware.cpu_count} cores · ${safeRedactedReceipt.hardware.total_memory_gb} GB</dd>
        <dt>cases</dt>          <dd>${safeRedactedReceipt.case_count}</dd>
      </dl>
      <p class="repro">Reproduce locally:</p>
      <pre><code>${escapeHtml(safeRedactedReceipt.repro_command)}</code></pre>
    </section>
  ` : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>verdict snapshot — ${escapeHtml(result.name)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font: 15px/1.55 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 0; background: #fafafa; color: #111; padding: 40px 24px 80px; }
  @media (prefers-color-scheme: dark) { body { background: #0e0f10; color: #eaeaea; } }
  main { max-width: 760px; margin: 0 auto; }
  header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
  header .meta { color: #00000080; font-size: 13px; }
  @media (prefers-color-scheme: dark) { header .meta { color: #ffffff70; } }
  .verdict-banner { margin: 28px 0 20px; padding: 18px 22px; background: linear-gradient(180deg, rgba(56, 161, 105, 0.08), rgba(56, 161, 105, 0.02)); border-left: 3px solid #16a34a; border-radius: 6px; }
  .verdict-banner h2 { margin: 0 0 6px; font-size: 16px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #15803d; }
  .verdict-banner .winner { font-size: 18px; font-weight: 600; }
  .verdict-banner .winner code { background: transparent; padding: 0; }
  .verdict-banner .synth { margin-top: 6px; color: #00000099; font-size: 13px; }
  @media (prefers-color-scheme: dark) { .verdict-banner .synth { color: #ffffff90; } }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 20px 0; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #00000015; }
  @media (prefers-color-scheme: dark) { th, td { border-bottom-color: #ffffff15; } }
  th { font-weight: 600; color: #00000080; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.rank { color: #00000070; }
  tr.winner td { font-weight: 600; }
  tr.winner td.rank::before { content: "🥇 "; }
  code { font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 5px; background: #00000010; border-radius: 3px; }
  @media (prefers-color-scheme: dark) { code { background: #ffffff15; } }
  .free { color: #16a34a; font-weight: 600; }
  .receipt { margin-top: 36px; padding: 18px 22px; background: #00000005; border-radius: 6px; font-size: 13px; }
  @media (prefers-color-scheme: dark) { .receipt { background: #ffffff05; } }
  .receipt h3 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #00000080; }
  @media (prefers-color-scheme: dark) { .receipt h3 { color: #ffffff90; } }
  .receipt dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 0; }
  .receipt dt { color: #00000080; }
  .receipt dd { margin: 0; }
  .receipt .repro { margin: 14px 0 6px; color: #00000080; }
  .receipt pre { margin: 0; padding: 10px 14px; background: #00000010; border-radius: 4px; font: 13px ui-monospace; overflow-x: auto; }
  @media (prefers-color-scheme: dark) { .receipt pre { background: #ffffff15; } }
  footer { margin-top: 36px; font-size: 12px; color: #00000060; text-align: center; }
  footer a { color: inherit; }
</style>
</head>
<body>
<main>
  <header>
    <h1>${escapeHtml(result.name)}</h1>
    <p class="meta">
      run <code>${escapeHtml(result.run_id)}</code> · ${escapeHtml(result.timestamp)} ·
      ${result.cases.length} case${result.cases.length === 1 ? '' : 's'}
    </p>
  </header>

  ${winner ? `
    <div class="verdict-banner">
      <h2>Verdict · winner</h2>
      <div class="winner"><code>${escapeHtml(winner.model_id)}</code> &middot; ${winner.avg_total.toFixed(2)} / 10</div>
      ${free && free.model_id !== winner.model_id ? `
        <div class="synth">cost-quality frontier: <strong><code>${escapeHtml(free.model_id)}</code></strong> is the free top-scorer at ${free.avg_total.toFixed(2)}</div>
      ` : ''}
      ${synthesisText ? `<div class="synth">${escapeHtml(synthesisText)}</div>` : ''}
    </div>
  ` : ''}

  <table>
    <thead>
      <tr><th>#</th><th>Model</th><th class="num">Score</th><th class="num">Latency</th><th class="num">Cost</th><th class="num">Wins</th></tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  ${receiptBlock}

  <footer>
    generated by <a href="https://github.com/hnshah/verdict" target="_blank" rel="noopener">verdict</a> · self-contained snapshot, drop me into any static host
  </footer>
</main>
</body>
</html>`
}

export async function shareCommand(resultPath: string, opts: ShareOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' share'))
  console.log()

  if (!fs.existsSync(resultPath)) {
    console.error(chalk.red(`  Result file not found: ${resultPath}`))
    console.error(chalk.dim(`  Pass the path to a verdict JSON result, e.g. results/2026-05-21-…json`))
    process.exit(1)
  }

  let result: RunResult
  try {
    result = JSON.parse(fs.readFileSync(resultPath, 'utf-8')) as RunResult
  } catch (err) {
    console.error(chalk.red(`  Could not parse ${resultPath}: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  // Look for a sibling receipt file: <base>-receipt.json
  const receiptPath = resultPath.replace(/\.json$/, '-receipt.json')
  let receipt: ReproReceipt | null = null
  if (fs.existsSync(receiptPath)) {
    try {
      receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf-8')) as ReproReceipt
    } catch {
      // Soft-fail: rendering without a receipt is fine.
    }
  }

  const html = renderShareHtml({ result, receipt })

  // Default output: cwd/verdict-share-<run_id>.html
  const outPath = opts.out
    ? path.resolve(opts.out)
    : path.resolve(`verdict-share-${result.run_id}.html`)

  fs.writeFileSync(outPath, html)
  console.log(chalk.green('  ✓ snapshot written'))
  console.log(chalk.dim('    ') + chalk.cyan(outPath))
  if (receipt) {
    console.log(chalk.dim('  ✓ includes receipt (') + chalk.cyan(receipt.hashes.config) + chalk.dim(')'))
  } else {
    console.log(chalk.dim('  · no receipt found — run verdict run after this PR lands to get reproducibility hashes'))
  }
  console.log()
  console.log(chalk.bold('  Share it:'))
  console.log(chalk.dim('    upload to GitHub Pages, S3, Netlify, R2, Vercel, or any static host'))
  console.log(chalk.dim('    open file://') + chalk.cyan(outPath) + chalk.dim(' to preview locally'))
  console.log()
}
