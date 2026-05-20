/**
 * Terminal reporter tests — focused on the deterministic verdict block.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import chalk from 'chalk'
import { printVerdict } from '../terminal.js'
import type { RunResult, ModelSummary } from '../../types/index.js'

function makeModelSummary(id: string, avgTotal: number, costUsd = 0): ModelSummary {
  return {
    model_id: id,
    avg_total: avgTotal,
    avg_accuracy: avgTotal,
    avg_completeness: avgTotal,
    avg_conciseness: avgTotal,
    avg_latency_ms: 1500,
    avg_tokens_per_sec: 40,
    total_cost_usd: costUsd,
    win_rate: 50,
    wins: 5,
    cases_run: 10,
    avg_solve_rate: 0.8,
  }
}

function makeResult(models: ModelSummary[]): RunResult {
  return {
    run_id: 'r1',
    name: 'Test',
    timestamp: '2026-05-19T00:00:00.000Z',
    models: models.map(m => m.model_id),
    cases: [],
    summary: Object.fromEntries(models.map(m => [m.model_id, m])),
  }
}

describe('printVerdict', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let captured: string

  beforeEach(() => {
    captured = ''
    stdoutSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      captured += args.join(' ') + '\n'
    })
    // Ensure colour codes appear so we can assert on them deterministically.
    chalk.level = 1
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
  })

  it('renders CLEAR when winner leads #2 by ≥ 0.5pts', () => {
    printVerdict(makeResult([
      makeModelSummary('alpha', 8.5),
      makeModelSummary('beta', 7.0),
    ]))
    expect(captured).toMatch(/VERDICT.*CLEAR/)
    expect(captured).toMatch(/WINNER.*alpha/)
  })

  it('renders LEAN when gap is 0.2–0.5pts', () => {
    printVerdict(makeResult([
      makeModelSummary('alpha', 8.5),
      makeModelSummary('beta', 8.2),
    ]))
    expect(captured).toMatch(/VERDICT.*LEAN/)
    expect(captured).toMatch(/Gap vs #2.*beta.*\+?0\.30pts/)
  })

  it('renders INCONCLUSIVE when gap < 0.2pts', () => {
    printVerdict(makeResult([
      makeModelSummary('alpha', 8.50),
      makeModelSummary('beta', 8.40),
    ]))
    expect(captured).toMatch(/VERDICT.*INCONCLUSIVE/)
    expect(captured).toMatch(/within noise/)
  })

  it('renders CLEAR when only one model has results', () => {
    printVerdict(makeResult([makeModelSummary('alpha', 8.5)]))
    expect(captured).toMatch(/VERDICT.*CLEAR/)
    expect(captured).toMatch(/alpha/)
  })

  it('prints cost-quality callout when free matches paid within 0.5pts', () => {
    printVerdict(makeResult([
      makeModelSummary('local-7b', 8.4, 0),
      makeModelSummary('cloud-pro', 8.6, 0.02),
    ]))
    expect(captured).toMatch(/local-7b matches cloud-pro/)
    expect(captured).toMatch(/Use local, save/)
  })

  it('prints "paid edge real" when paid leads free by ≥ 0.5pts', () => {
    printVerdict(makeResult([
      makeModelSummary('cloud-pro', 9.0, 0.02),
      makeModelSummary('local-7b', 7.5, 0),
    ]))
    expect(captured).toMatch(/cloud-pro leads local-7b/)
    expect(captured).toMatch(/paid edge real/)
  })

  it('handles all-zero results gracefully', () => {
    const m = makeModelSummary('alpha', 0)
    m.cases_run = 0
    printVerdict(makeResult([m]))
    expect(captured).toMatch(/No models produced results/)
  })
})
