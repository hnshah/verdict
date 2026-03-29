/**
 * Markdown reporter tests
 */

import { describe, it, expect } from 'vitest'
import { generateMarkdownReport } from '../markdown.js'
import type { RunResult, ModelSummary } from '../../types/index.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeModelSummary(id: string, avgTotal: number): ModelSummary {
  return {
    model_id: id,
    avg_total: avgTotal,
    avg_accuracy: avgTotal,
    avg_completeness: avgTotal,
    avg_conciseness: avgTotal,
    avg_latency_ms: 1500,
    avg_tokens_per_sec: 40,
    total_cost_usd: 0.0012,
    win_rate: 70,
    wins: 7,
    cases_run: 10,
    avg_solve_rate: 0.85,
  }
}

function makeRunResult(overrides: Partial<RunResult> = {}): RunResult {
  const m1 = makeModelSummary('model-a', 8.5)
  const m2 = makeModelSummary('model-b', 7.2)
  return {
    run_id: 'run-test-001',
    name: 'My Test Run',
    timestamp: '2026-03-29T01:00:00.000Z',
    models: ['model-a', 'model-b'],
    cases: [],
    summary: { 'model-a': m1, 'model-b': m2 },
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateMarkdownReport', () => {
  it('returns a non-empty string', () => {
    const md = generateMarkdownReport(makeRunResult())
    expect(typeof md).toBe('string')
    expect(md.length).toBeGreaterThan(100)
  })

  it('includes run name and run_id', () => {
    const md = generateMarkdownReport(makeRunResult())
    expect(md).toContain('My Test Run')
    expect(md).toContain('run-test-001')
  })

  it('includes a Leaderboard section', () => {
    const md = generateMarkdownReport(makeRunResult())
    expect(md).toContain('## Leaderboard')
  })

  it('lists all models in the leaderboard', () => {
    const md = generateMarkdownReport(makeRunResult())
    expect(md).toContain('model-a')
    expect(md).toContain('model-b')
  })

  it('sorts models by avg_total descending', () => {
    const md = generateMarkdownReport(makeRunResult())
    const posA = md.indexOf('model-a')
    const posB = md.indexOf('model-b')
    // model-a (8.5) should appear before model-b (7.2)
    expect(posA).toBeLessThan(posB)
  })

  it('formats cost as free for zero-cost models', () => {
    const m = { ...makeModelSummary('free-model', 9.0), total_cost_usd: 0 }
    const result = makeRunResult({
      models: ['free-model'],
      summary: { 'free-model': m },
    })
    const md = generateMarkdownReport(result)
    expect(md).toContain('free')
  })

  it('formats non-zero cost with dollar sign', () => {
    const md = generateMarkdownReport(makeRunResult())
    expect(md).toMatch(/\$\d+\.\d{4}/)
  })

  it('includes Cases section (empty when no cases)', () => {
    const md = generateMarkdownReport(makeRunResult())
    expect(md).toContain('## Cases')
  })

  it('includes case details when cases are present', () => {
    const result = makeRunResult({
      cases: [
        {
          case_id: 'test-case-1',
          prompt: 'What is 2+2?',
          scores: {
            'model-a': { accuracy: 10, completeness: 10, conciseness: 10, total: 10, reasoning: 'Correct.' },
          },
        },
      ],
    })
    const md = generateMarkdownReport(result)
    expect(md).toContain('test-case-1')
    expect(md).toContain('What is 2+2?')
    expect(md).toContain('Correct.')
  })

  it('includes synthesis section when synthesis provided', () => {
    const result = makeRunResult({
      synthesis: {
        verdict: 'CLEAR',
        confidence: 'HIGH',
        recommendation: 'Use model-a',
        keyFinding: 'model-a wins on accuracy',
        caveats: 'Only tested general tasks',
      },
    })
    const md = generateMarkdownReport(result)
    expect(md).toContain('## Synthesis')
    expect(md).toContain('CLEAR')
    expect(md).toContain('Use model-a')
  })

  it('omits synthesis section when no synthesis', () => {
    const md = generateMarkdownReport(makeRunResult())
    expect(md).not.toContain('## Synthesis')
  })

  it('includes baseline comparison when provided', () => {
    const result = makeRunResult({
      baselineComparison: {
        baselineName: 'prod-v1',
        baselineDate: '2026-03-01',
        deltas: [
          { model: 'model-a', scoreA: 8.0, scoreB: 8.5, delta: 0.5, pctChange: 6.25, regression: false },
          { model: 'model-b', scoreA: 8.0, scoreB: 7.2, delta: -0.8, pctChange: -10, regression: true },
        ],
        newModels: [],
        removedModels: [],
        regressionAlert: true,
      },
    })
    const md = generateMarkdownReport(result)
    expect(md).toContain('## Baseline Comparison')
    expect(md).toContain('prod-v1')
    expect(md).toContain('REGRESSION')
    expect(md).toContain('+0.50')
  })

  it('includes timestamp in date field', () => {
    const md = generateMarkdownReport(makeRunResult())
    expect(md).toContain('2026-03-29 01:00:00 UTC')
  })
})
