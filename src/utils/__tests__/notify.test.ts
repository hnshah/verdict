import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eventsFromRun, dispatch, notifyRun } from '../notify.js'
import type { RunResult, ModelSummary, BaselineComparison } from '../../types/index.js'

function ms(id: string, avg: number, costUsd = 0): ModelSummary {
  return {
    model_id: id,
    avg_total: avg,
    avg_accuracy: avg,
    avg_completeness: avg,
    avg_conciseness: avg,
    avg_latency_ms: 1000,
    avg_tokens_per_sec: 30,
    total_cost_usd: costUsd,
    win_rate: 50,
    wins: 5,
    cases_run: 10,
    avg_solve_rate: 0.5,
  }
}

function result(summaries: ModelSummary[], extras: Partial<RunResult> = {}): RunResult {
  return {
    run_id: 'r',
    name: 'test',
    timestamp: '2026-05-19T00:00:00.000Z',
    models: summaries.map(s => s.model_id),
    cases: [],
    summary: Object.fromEntries(summaries.map(s => [s.model_id, s])),
    ...extras,
  }
}

describe('eventsFromRun', () => {
  it('emits new_winner event when leader changes', () => {
    const r = result([ms('beta', 8.5), ms('alpha', 7.5)])
    const events = eventsFromRun(r, 'alpha')
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('new_winner')
    expect(events[0].body).toMatch(/beta took #1/)
    expect(events[0].body).toMatch(/was: alpha/)
  })

  it('does not emit new_winner when leader unchanged', () => {
    const r = result([ms('alpha', 8.5), ms('beta', 7.5)])
    expect(eventsFromRun(r, 'alpha')).toHaveLength(0)
  })

  it('does not emit new_winner when no prevWinner is given', () => {
    const r = result([ms('alpha', 8.5), ms('beta', 7.5)])
    expect(eventsFromRun(r)).toHaveLength(0)
  })

  it('emits regression event when baseline comparison has regressionAlert', () => {
    const baselineComparison: BaselineComparison = {
      baselineName: 'production',
      baselineDate: '2026-04-01',
      deltas: [
        { model: 'alpha', scoreA: 8.0, scoreB: 6.5, delta: -1.5, pctChange: -19, regression: true },
      ],
      newModels: [],
      removedModels: [],
      regressionAlert: true,
    }
    const r = result([ms('alpha', 6.5)], { baselineComparison })
    const events = eventsFromRun(r, 'alpha')
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('regression')
    expect(events[0].body).toMatch(/production/)
    expect(events[0].body).toMatch(/alpha -1.50/)
  })

  it('can emit both new_winner and regression in one run', () => {
    const baselineComparison: BaselineComparison = {
      baselineName: 'production',
      baselineDate: '2026-04-01',
      deltas: [{ model: 'alpha', scoreA: 9.0, scoreB: 7.5, delta: -1.5, pctChange: -17, regression: true }],
      newModels: [],
      removedModels: [],
      regressionAlert: true,
    }
    const r = result([ms('beta', 8.5), ms('alpha', 7.5)], { baselineComparison })
    const events = eventsFromRun(r, 'alpha')
    expect(events.map(e => e.kind).sort()).toEqual(['new_winner', 'regression'])
  })
})

describe('dispatch', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('posts to slack webhook when configured', async () => {
    await dispatch(
      { kind: 'new_winner', title: 't', body: 'b' },
      { slack: { webhook_url: 'https://hook.test/x' }, macos: { enabled: false } },
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://hook.test/x')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.attachments[0].title).toBe('t')
    expect(body.attachments[0].color).toBe('#16a34a')
  })

  it('respects per-trigger disable flag', async () => {
    await dispatch(
      { kind: 'new_winner', title: 't', body: 'b' },
      {
        slack: { webhook_url: 'https://hook.test/x' },
        macos: { enabled: false },
        triggers: { new_winner: false },
      },
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('regression uses red color', async () => {
    await dispatch(
      { kind: 'regression', title: 't', body: 'b' },
      { slack: { webhook_url: 'https://hook.test/x' }, macos: { enabled: false } },
    )
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.attachments[0].color).toBe('#dc2626')
  })

  it('swallows fetch errors', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('boom'))
    await expect(dispatch(
      { kind: 'new_winner', title: 't', body: 'b' },
      { slack: { webhook_url: 'https://hook.test/x' }, macos: { enabled: false } },
    )).resolves.not.toThrow()
  })

  it('does nothing when cfg is undefined', async () => {
    await dispatch({ kind: 'new_winner', title: 't', body: 'b' }, undefined)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('notifyRun', () => {
  it('dispatches all events from a run', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const baselineComparison: BaselineComparison = {
      baselineName: 'production', baselineDate: '2026-04-01',
      deltas: [{ model: 'alpha', scoreA: 9, scoreB: 7.5, delta: -1.5, pctChange: -17, regression: true }],
      newModels: [], removedModels: [], regressionAlert: true,
    }
    const r = result([ms('beta', 8.5), ms('alpha', 7.5)], { baselineComparison })
    await notifyRun(r, { slack: { webhook_url: 'https://hook.test/x' }, macos: { enabled: false } }, 'alpha')
    expect(fetchSpy).toHaveBeenCalledTimes(2) // new_winner + regression
  })

  it('no-ops when no cfg', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const r = result([ms('beta', 8.5), ms('alpha', 7.5)])
    await notifyRun(r, undefined, 'alpha')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
