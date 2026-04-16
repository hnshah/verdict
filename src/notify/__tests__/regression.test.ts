import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { detectRegression } from '../regression.js'
import { buildPayload } from '../index.js'
import type { RegressionReport } from '../index.js'
import type { RunResult } from '../../types/index.js'

function makeRun(overrides: Partial<RunResult>, scores: Record<string, number>): RunResult {
  return {
    run_id: overrides.run_id ?? 'run-1',
    name: 'test',
    timestamp: overrides.timestamp ?? '2026-04-15T00:00:00Z',
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
    ...overrides,
  }
}

describe('detectRegression', () => {
  let tmp: string

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-reg-'))
    fs.mkdirSync(path.join(tmp, '.verdict-baselines'), { recursive: true })
  })

  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

  it('returns null when no baseline name is provided', () => {
    const result = makeRun({}, { m1: 8 })
    expect(detectRegression(result, undefined, tmp)).toBeNull()
  })

  it('returns null when the named baseline does not exist', () => {
    const result = makeRun({}, { m1: 8 })
    expect(detectRegression(result, 'missing', tmp)).toBeNull()
  })

  it('flags regressions past the 0.5 threshold', () => {
    const baseline = makeRun({ run_id: 'baseline' }, { m1: 8.0, m2: 7.0 })
    fs.writeFileSync(path.join(tmp, '.verdict-baselines', 'prod.json'), JSON.stringify(baseline))

    // m1 regresses by -1 (> 0.5) ; m2 stays the same
    const current = makeRun({ run_id: 'current' }, { m1: 7.0, m2: 7.0 })
    const report = detectRegression(current, 'prod', tmp)
    expect(report).not.toBeNull()
    expect(report!.regressed).toBe(true)
    expect(report!.regressions).toHaveLength(1)
    expect(report!.regressions[0].model).toBe('m1')
    expect(report!.regressions[0].delta).toBe(-1)
  })

  it('does not flag sub-threshold changes', () => {
    const baseline = makeRun({ run_id: 'baseline' }, { m1: 8.0 })
    fs.writeFileSync(path.join(tmp, '.verdict-baselines', 'prod.json'), JSON.stringify(baseline))
    // Δ = -0.3, under the 0.5 threshold
    const current = makeRun({ run_id: 'current' }, { m1: 7.7 })
    const report = detectRegression(current, 'prod', tmp)!
    expect(report.regressed).toBe(false)
    expect(report.regressions).toHaveLength(0)
  })

  it('identifies new and removed models', () => {
    const baseline = makeRun({ run_id: 'baseline' }, { old: 8 })
    fs.writeFileSync(path.join(tmp, '.verdict-baselines', 'prod.json'), JSON.stringify(baseline))
    const current = makeRun({ run_id: 'current' }, { new_m: 9 })
    const report = detectRegression(current, 'prod', tmp)!
    expect(report.newModels).toEqual(['new_m'])
    expect(report.removedModels).toEqual(['old'])
  })
})

describe('buildPayload', () => {
  it('produces a slack-friendly text + structured body', () => {
    const report: RegressionReport = {
      regressed: true,
      baselineName: 'prod',
      deltas: [{ model: 'a', scoreA: 8, scoreB: 7, delta: -1, pctChange: -12.5, regression: true }],
      regressions: [{ model: 'a', scoreA: 8, scoreB: 7, delta: -1, pctChange: -12.5, regression: true }],
      newModels: [],
      removedModels: [],
    }
    const result = {
      run_id: 'run-xyz', name: 'test', timestamp: '2026-04-15T00:00:00Z',
      models: [], cases: [], summary: {},
    }
    const payload = buildPayload('my-schedule', result, report) as Record<string, unknown>
    expect(payload.text).toContain('regression detected')
    expect(payload.text).toContain('my-schedule')
    expect(payload.schedule).toBe('my-schedule')
    expect(payload.run_id).toBe('run-xyz')
    expect(payload.baseline).toBe('prod')
    expect((payload.regressions as unknown[]).length).toBe(1)
  })
})
