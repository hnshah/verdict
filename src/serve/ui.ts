/**
 * Local web UI for `verdict serve --ui`.
 *
 * Read-only, localhost-only. Serves a TUI-styled React dashboard (loaded via
 * CDN React + Babel — no build step) plus JSON endpoints that pull from
 * ~/.verdict/results.db.
 *
 * Endpoints:
 *   GET /                        → index.html with SSR data
 *   GET /ui                      → same
 *   GET /ui/static/*             → static design assets (css, jsx, js)
 *   GET /ui/runs                 → list runs (existing shape)
 *   GET /ui/runs/:run_id/cases   → per-case results for a run
 *   GET /ui/leaderboard          → aggregated top-N model leaderboard
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type Database from 'better-sqlite3'
import { queryHistory, queryCaseResults, queryLeaderboard } from '../db/client.js'

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

const STATIC_DIR = (() => {
  // When loaded from `dist/serve/ui.js`, the static assets sit next to us at
  // `dist/serve/ui-static/`. In dev (running from `src/`), look one dir up.
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(here, 'ui-static'),                  // dist/serve/ui-static
    path.join(here, '..', '..', 'src', 'serve', 'ui-static'), // dist→repo root
    path.join(here, '..', '..', 'serve', 'ui-static'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return candidates[0]
})()

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'text/babel; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

function buildRuns(db: Database.Database) {
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
  return Array.from(grouped.values())
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
}

function buildLeaderboard(db: Database.Database) {
  return queryLeaderboard(db, { limit: 10 })
}

/** GET /ui/runs — list of runs (grouped by run_id). */
export function handleUiRuns(res: http.ServerResponse, db: Database.Database): void {
  const runs = buildRuns(db)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ runs, meta: { version: '0.4.0', path: '~/.verdict' } }))
}

/** GET /ui/runs/:run_id/cases — per-case rows for the drill-in panel. */
export function handleUiCases(res: http.ServerResponse, db: Database.Database, runId: string): void {
  const rows = queryCaseResults(db, runId)
  // Group by case_id so each unique case appears once, with all models' scores.
  // For the design's drill-in (which lists cases for a single run), pick the
  // top-scoring model per case for a quick read-only view.
  const byCase = new Map<string, ReturnType<typeof queryCaseResults>[number]>()
  for (const r of rows) {
    const existing = byCase.get(r.case_id)
    if (!existing || r.score > existing.score) byCase.set(r.case_id, r)
  }
  const cases = Array.from(byCase.values()).map(r => ({
    case_id: r.case_id,
    score: r.score,
    latency_ms: r.latency_ms,
    prompt: r.prompt,
    response: r.response,
    model_id: r.model_id,
    category: null,
  }))
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ run_id: runId, cases }))
}

/** GET /ui/leaderboard — aggregated top-N model leaderboard. */
export function handleUiLeaderboard(res: http.ServerResponse, db: Database.Database): void {
  const leaderboard = buildLeaderboard(db)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ leaderboard, meta: { version: '0.4.0' } }))
}

/** GET /ui/static/* — serve design system assets from disk. */
export function handleUiStatic(res: http.ServerResponse, urlPath: string): void {
  // urlPath starts with '/ui/static/'. Strip the prefix and resolve.
  const rel = urlPath.replace(/^\/ui\/static\/?/, '')
  // Reject traversal attempts.
  if (rel.includes('..')) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  const target = path.join(STATIC_DIR, rel)
  // Resolve and confirm the result is inside STATIC_DIR (belt-and-braces).
  const resolved = path.resolve(target)
  if (!resolved.startsWith(path.resolve(STATIC_DIR))) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  const ext = path.extname(resolved).toLowerCase()
  const mime = MIME[ext] ?? 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' })
  fs.createReadStream(resolved).pipe(res)
}

/**
 * GET / and GET /ui — serve index.html with SSR data placeholder filled in.
 * The placeholder `<!-- @SSR_DATA -->` is replaced with a script tag that
 * sets `window.VERDICT_DATA_SSR` so the React app has data on first paint.
 */
export function handleUiIndex(res: http.ServerResponse, db: Database.Database): void {
  const indexPath = path.join(STATIC_DIR, 'index.html')
  if (!fs.existsSync(indexPath)) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Dashboard assets missing. Reinstall verdict or run `npm run build`.')
    return
  }
  let html = fs.readFileSync(indexPath, 'utf-8')

  // Build the SSR payload — keep it small enough to inline.
  const runs = buildRuns(db)
  const leaderboard = buildLeaderboard(db)
  // Include cases for the most-recent run so the drill-in has data immediately.
  const cases: Record<string, ReturnType<typeof queryCaseResults>> = {}
  if (runs[0]) {
    cases[runs[0].run_id] = queryCaseResults(db, runs[0].run_id)
  }
  const ssr = {
    runs,
    leaderboard,
    cases,
    meta: { version: '0.4.0', path: '~/.verdict' },
  }
  // JSON-encode and escape `</script>` to prevent injection.
  const json = JSON.stringify(ssr).replace(/</g, '\\u003c')
  const script = `<script>window.VERDICT_DATA_SSR = ${json};</script>`
  html = html.replace('<!-- @SSR_DATA -->', script)

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}
