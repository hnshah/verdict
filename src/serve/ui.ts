/**
 * Local web UI for `verdict serve --ui`.
 *
 * Read-only, no auth, localhost-only. Serves a single HTML page plus a
 * /ui/runs JSON endpoint that pulls from ~/.verdict/results.db.
 *
 * No framework, no build step — vanilla HTML + a sprinkle of JS so the
 * dashboard is discoverable without setting up GitHub Pages.
 */

import http from 'http'
import type Database from 'better-sqlite3'
import { queryHistory } from '../db/client.js'

interface RunRow {
  run_id: string
  name: string
  model_id: string
  provider: string | null
  pack: string
  score: number
  max_score: number
  cases_run: number
  wins: number
  avg_latency_ms: number
  total_cost_usd: number
  tokens_per_sec: number
  run_at: string
}

/**
 * GET /ui/runs — returns up to 200 most-recent runs grouped by run_id.
 */
export function handleUiRuns(res: http.ServerResponse, db: Database.Database): void {
  const rows = queryHistory(db, { limit: 200 }) as RunRow[]
  const grouped = new Map<string, { run_id: string; run_at: string; name: string; pack: string; rows: RunRow[] }>()
  for (const row of rows) {
    let g = grouped.get(row.run_id)
    if (!g) {
      g = { run_id: row.run_id, run_at: row.run_at, name: row.name, pack: row.pack, rows: [] }
      grouped.set(row.run_id, g)
    }
    g.rows.push(row)
  }
  const runs = Array.from(grouped.values())
    .sort((a, b) => b.run_at.localeCompare(a.run_at))
    .map(g => {
      const sorted = [...g.rows].sort((a, b) => b.score - a.score)
      const winner = sorted[0]
      return {
        run_id: g.run_id,
        run_at: g.run_at,
        name: g.name,
        pack: g.pack,
        winner: winner?.model_id ?? null,
        winner_score: winner?.score ?? null,
        cases_run: winner?.cases_run ?? 0,
        models: sorted.map(r => ({
          model_id: r.model_id,
          provider: r.provider,
          score: r.score,
          latency_ms: r.avg_latency_ms,
          cost_usd: r.total_cost_usd,
          wins: r.wins,
        })),
      }
    })

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ runs }))
}

/**
 * GET / and GET /ui — serves the HTML page.
 */
export function handleUiIndex(res: http.ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(UI_HTML)
}

const UI_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verdict — local dashboard</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 0; background: #fafafa; color: #111; }
  @media (prefers-color-scheme: dark) { body { background: #0e0f10; color: #eaeaea; } }
  header { padding: 24px 32px; border-bottom: 1px solid #00000020; display: flex; align-items: baseline; gap: 16px; }
  header h1 { margin: 0; font-size: 18px; font-weight: 700; }
  header .meta { color: #00000080; font-size: 12px; }
  main { padding: 24px 32px; }
  .runs { display: flex; flex-direction: column; gap: 16px; }
  .run { border: 1px solid #00000020; border-radius: 8px; padding: 16px; background: #ffffff80; }
  @media (prefers-color-scheme: dark) { .run { background: #1a1b1c; border-color: #ffffff20; } }
  .run-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .run-head h2 { margin: 0; font-size: 14px; font-weight: 600; }
  .run-head .ts { color: #00000060; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #00000010; }
  th { font-weight: 600; color: #00000080; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  td.score { font-weight: 700; }
  td.score.high { color: #16a34a; }
  td.score.mid { color: #ca8a04; }
  td.score.low { color: #dc2626; }
  .empty { padding: 32px; text-align: center; color: #00000060; }
  code { font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 5px; background: #00000010; border-radius: 3px; }
</style>
</head>
<body>
<header>
  <h1>Verdict</h1>
  <span class="meta">local dashboard · <span id="run-count">…</span> runs · read from <code>~/.verdict/results.db</code></span>
</header>
<main>
<div id="content">Loading…</div>
</main>
<script>
(async () => {
  const content = document.getElementById('content')
  const runCount = document.getElementById('run-count')
  try {
    const res = await fetch('/ui/runs')
    const data = await res.json()
    runCount.textContent = data.runs.length
    if (data.runs.length === 0) {
      content.innerHTML = '<div class="empty">No runs yet. Try <code>verdict run</code>.</div>'
      return
    }
    const html = ['<div class="runs">']
    for (const run of data.runs) {
      const date = new Date(run.run_at).toLocaleString()
      html.push('<div class="run">')
      html.push('<div class="run-head"><h2>' + escape(run.name) + ' · <code>' + escape(run.pack) + '</code></h2><span class="ts">' + escape(date) + '</span></div>')
      html.push('<table><thead><tr><th>Rank</th><th>Model</th><th>Provider</th><th>Score</th><th>Latency</th><th>Cost</th><th>Wins</th></tr></thead><tbody>')
      run.models.forEach((m, i) => {
        const cls = m.score >= 8 ? 'high' : m.score >= 6 ? 'mid' : 'low'
        const cost = m.cost_usd > 0 ? '$' + m.cost_usd.toFixed(4) : 'free'
        const latency = (m.latency_ms / 1000).toFixed(1) + 's'
        html.push('<tr><td>' + (i+1) + '</td><td><code>' + escape(m.model_id) + '</code></td><td>' + escape(m.provider || '') + '</td><td class="score ' + cls + '">' + m.score.toFixed(2) + '</td><td>' + latency + '</td><td>' + cost + '</td><td>' + m.wins + '</td></tr>')
      })
      html.push('</tbody></table>')
      html.push('</div>')
    }
    html.push('</div>')
    content.innerHTML = html.join('')
  } catch (err) {
    content.innerHTML = '<div class="empty">Error loading runs: ' + escape(String(err)) + '</div>'
  }
  function escape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
})()
</script>
</body>
</html>
`
