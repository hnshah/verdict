import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createServer, type Server } from 'http'
import { notifyRegression } from '../index.js'
import type { ScheduleRow } from '../../db/client.js'
import type { RunResult } from '../../types/index.js'

function makeSchedule(overrides: Partial<ScheduleRow> = {}): ScheduleRow {
  return {
    id: 1, name: 'nightly', cron: '0 2 * * *',
    config_path: null, packs: null, models: null, category: null,
    enabled: 1, on_regression: null,
    last_run_at: null, last_run_id: null, last_status: null, next_run_at: null,
    created_at: '2026-04-15T00:00:00Z', source: 'cli',
    ...overrides,
  }
}

function makeRun(scores: Record<string, number>): RunResult {
  return {
    run_id: 'r', name: 'n', timestamp: '2026-04-15T00:00:00Z',
    models: Object.keys(scores),
    cases: [],
    summary: Object.fromEntries(Object.entries(scores).map(([id, s]) => [
      id,
      {
        model_id: id, avg_total: s, avg_accuracy: s, avg_completeness: s,
        avg_conciseness: s, avg_latency_ms: 0, avg_tokens_per_sec: 0,
        total_cost_usd: 0, win_rate: 0, wins: 0, cases_run: 1, avg_solve_rate: 0,
      },
    ])),
  }
}

describe('notifyRegression orchestrator', () => {
  let tmp: string
  let server: Server | null = null

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-notify-'))
    fs.mkdirSync(path.join(tmp, '.verdict-baselines'), { recursive: true })
  })

  afterEach(() => {
    if (server) { server.close(); server = null }
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('skips silently when on_regression is null', async () => {
    const logs: string[] = []
    const outcome = await notifyRegression({
      schedule: makeSchedule({ on_regression: null }),
      result: makeRun({ m1: 8 }),
      cwd: tmp,
      log: m => logs.push(m),
    })
    expect(outcome.report).toBeNull()
    expect(logs).toHaveLength(0)
  })

  it('returns report with regressed=false when current matches baseline', async () => {
    fs.writeFileSync(path.join(tmp, '.verdict-baselines', 'p.json'), JSON.stringify(makeRun({ m1: 8 })))
    const outcome = await notifyRegression({
      schedule: makeSchedule({ on_regression: JSON.stringify({ baseline: 'p', stdout: false }) }),
      result: makeRun({ m1: 8 }),
      cwd: tmp,
    })
    expect(outcome.report).not.toBeNull()
    expect(outcome.report!.regressed).toBe(false)
  })

  it('posts to webhook on regression + prints stdout when enabled', async () => {
    fs.writeFileSync(path.join(tmp, '.verdict-baselines', 'p.json'), JSON.stringify(makeRun({ m1: 8 })))

    const received: string[] = []
    server = createServer((req, res) => {
      let body = ''
      req.on('data', c => body += c.toString())
      req.on('end', () => { received.push(body); res.statusCode = 200; res.end() })
    })
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', () => resolve()))
    const addr = server.address()
    const webhook = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/`

    const logs: string[] = []
    const outcome = await notifyRegression({
      schedule: makeSchedule({
        on_regression: JSON.stringify({ baseline: 'p', webhook, stdout: true }),
      }),
      result: makeRun({ m1: 6.5 }),  // Δ = -1.5, well past threshold
      cwd: tmp,
      log: m => logs.push(m),
    })

    expect(outcome.report?.regressed).toBe(true)
    expect(outcome.webhook?.ok).toBe(true)
    expect(received).toHaveLength(1)
    const payload = JSON.parse(received[0])
    expect(payload.schedule).toBe('nightly')
    expect(payload.regressions).toHaveLength(1)
    expect(logs.some(l => l.includes('Regression detected'))).toBe(true)
  })

  it('gracefully handles malformed on_regression JSON', async () => {
    const outcome = await notifyRegression({
      schedule: makeSchedule({ on_regression: 'not-json{' }),
      result: makeRun({ m1: 8 }),
      cwd: tmp,
    })
    expect(outcome.report).toBeNull()
  })
})
