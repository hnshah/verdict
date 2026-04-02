import { describe, it, expect, vi } from 'vitest'
import type { RunResult } from '../../../types/index.js'
import { runCompare } from '../compare.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Helper to write a fake run result file
function makeRunResult(models: Record<string, number>): RunResult {
  const modelIds = Object.keys(models)
  return {
    run_id: `run_${Math.random().toString(36).slice(2)}`,
    name: 'Test',
    timestamp: '2026-04-02T06:00:00.000Z',
    models: modelIds,
    cases: [],
    summary: Object.fromEntries(
      modelIds.map(id => [id, {
        model_id: id,
        avg_total: models[id],
        avg_accuracy: models[id],
        avg_completeness: models[id],
        avg_conciseness: models[id],
        avg_latency_ms: 1000,
        avg_tokens_per_sec: 100,
        total_cost_usd: 0,
        win_rate: 100,
        wins: 1,
        cases_run: 1,
        avg_solve_rate: 1,
      }])
    ),
  } as unknown as RunResult
}

function withTempFiles(
  a: ReturnType<typeof makeRunResult>,
  b: ReturnType<typeof makeRunResult>,
  fn: (pathA: string, pathB: string) => void | Promise<void>
): Promise<void> | void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-compare-test-'))
  const pathA = path.join(dir, 'run-a.json')
  const pathB = path.join(dir, 'run-b.json')
  fs.writeFileSync(pathA, JSON.stringify(a))
  fs.writeFileSync(pathB, JSON.stringify(b))
  try {
    return fn(pathA, pathB)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// ─── runCompare (structured result) ─────────────────────────────────────────

describe('runCompare — structured result (issue #104)', () => {
  it('returns improved status when score increases', () => {
    const a = makeRunResult({ 'model-a': 7.0 })
    const b = makeRunResult({ 'model-a': 8.5 })
    withTempFiles(a, b, (pA, pB) => {
      const result = runCompare(pA, pB)
      const m = result.models[0]
      expect(m.model).toBe('model-a')
      expect(m.scoreBaseline).toBe(7.0)
      expect(m.scoreCurrent).toBe(8.5)
      expect(m.delta).toBeCloseTo(1.5, 1)
      expect(m.status).toBe('improved')
      expect(m.regression).toBe(false)
    })
  })

  it('returns declined status when score decreases below threshold', () => {
    const a = makeRunResult({ 'model-a': 8.0 })
    const b = makeRunResult({ 'model-a': 7.6 })
    withTempFiles(a, b, (pA, pB) => {
      const result = runCompare(pA, pB, 0.5) // threshold 0.5 — drop of 0.4 is NOT regression
      const m = result.models[0]
      expect(m.status).toBe('declined')
      expect(m.regression).toBe(false)
      expect(result.summary.regressionDetected).toBe(false)
    })
  })

  it('returns regression status when drop exceeds threshold', () => {
    const a = makeRunResult({ 'model-a': 8.0 })
    const b = makeRunResult({ 'model-a': 7.0 })
    withTempFiles(a, b, (pA, pB) => {
      const result = runCompare(pA, pB, 0.5) // drop of 1.0 > 0.5 → regression
      const m = result.models[0]
      expect(m.status).toBe('regression')
      expect(m.regression).toBe(true)
      expect(result.summary.regressionDetected).toBe(true)
    })
  })

  it('returns no_change for tiny delta', () => {
    const a = makeRunResult({ 'model-a': 8.0 })
    const b = makeRunResult({ 'model-a': 8.02 })
    withTempFiles(a, b, (pA, pB) => {
      const result = runCompare(pA, pB)
      expect(result.models[0].status).toBe('no_change')
    })
  })

  it('marks new models', () => {
    const a = makeRunResult({ 'model-a': 8.0 })
    const b = makeRunResult({ 'model-a': 8.0, 'model-b': 7.5 })
    withTempFiles(a, b, (pA, pB) => {
      const result = runCompare(pA, pB)
      const newModel = result.models.find(m => m.model === 'model-b')
      expect(newModel?.status).toBe('new')
      expect(newModel?.scoreBaseline).toBeNull()
      expect(result.summary.newModels).toBe(1)
    })
  })

  it('marks removed models', () => {
    const a = makeRunResult({ 'model-a': 8.0, 'model-b': 7.5 })
    const b = makeRunResult({ 'model-a': 8.0 })
    withTempFiles(a, b, (pA, pB) => {
      const result = runCompare(pA, pB)
      const removed = result.models.find(m => m.model === 'model-b')
      expect(removed?.status).toBe('removed')
      expect(removed?.scoreCurrent).toBeNull()
      expect(result.summary.removedModels).toBe(1)
    })
  })

  it('no regression when threshold is not exceeded', () => {
    const a = makeRunResult({ 'model-a': 8.0, 'model-b': 7.0 })
    const b = makeRunResult({ 'model-a': 7.7, 'model-b': 7.6 })
    withTempFiles(a, b, (pA, pB) => {
      const result = runCompare(pA, pB, 0.5) // drops: 0.3 and -0.6 → model-b improved
      expect(result.summary.regressionDetected).toBe(false)
    })
  })

  it('multiple models — detects regression in one', () => {
    const a = makeRunResult({ 'model-a': 8.0, 'model-b': 7.0 })
    const b = makeRunResult({ 'model-a': 8.2, 'model-b': 5.0 })
    withTempFiles(a, b, (pA, pB) => {
      const result = runCompare(pA, pB, 0.5)
      expect(result.summary.regressionDetected).toBe(true)
      const regressions = result.models.filter(m => m.regression)
      expect(regressions).toHaveLength(1)
      expect(regressions[0].model).toBe('model-b')
    })
  })

  it('throws on missing file', () => {
    expect(() => runCompare('/nonexistent/a.json', '/nonexistent/b.json')).toThrow('File not found')
  })
})

// ─── CI mode summary format tests ────────────────────────────────────────────

describe('CI mode — step summary format', () => {
  it('verdict compare summary includes Model header', () => {
    const a = makeRunResult({ 'model-a': 7.0 })
    const b = makeRunResult({ 'model-a': 8.5 })
    withTempFiles(a, b, (pA, pB) => {
      const result = runCompare(pA, pB)
      // Verify the structured result has what we'd render in a step summary
      const lines = [
        '## verdict Eval Results',
        '',
        `| Model | Score | vs Baseline | Status |`,
        `|-------|-------|-------------|--------|`,
      ]
      for (const m of result.models) {
        if (m.scoreBaseline !== null && m.scoreCurrent !== null) {
          const d = m.delta!
          const dStr = d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2)
          lines.push(`| ${m.model} | ${m.scoreCurrent.toFixed(2)} | ${dStr} | improved |`)
        }
      }
      const summary = lines.join('\n')
      expect(summary).toContain('model-a')
      expect(summary).toContain('+1.50')
      expect(summary).toContain('improved')
    })
  })
})
