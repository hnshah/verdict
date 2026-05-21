import { describe, it, expect } from 'vitest'
import { renderShareHtml } from '../share.js'
import type { RunResult } from '../../../types/index.js'
import type { ReproReceipt } from '../../../core/receipt.js'

function makeResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    run_id: 'test-run-1',
    name: 'My Evals',
    timestamp: '2026-05-21T00:00:00Z',
    models: ['m1', 'm2'],
    cases: [
      { case_id: 'c1', prompt: 'hi', criteria: 'be polite', responses: {}, scores: {} },
    ] as any,
    summary: {
      m1: {
        model_id: 'm1', avg_total: 9.2, avg_accuracy: 9, avg_completeness: 9, avg_conciseness: 9.5,
        avg_latency_ms: 1200, avg_tokens_per_sec: 80, total_cost_usd: 0,
        win_rate: 1, wins: 1, cases_run: 1, avg_solve_rate: 1,
      },
      m2: {
        model_id: 'm2', avg_total: 8.1, avg_accuracy: 8, avg_completeness: 8, avg_conciseness: 8.5,
        avg_latency_ms: 900, avg_tokens_per_sec: 90, total_cost_usd: 0.05,
        win_rate: 0, wins: 0, cases_run: 1, avg_solve_rate: 0.5,
      },
    },
    ...overrides,
  } as RunResult
}

function makeReceipt(): ReproReceipt {
  return {
    receipt_version: 1,
    generated_at: '2026-05-21T00:00:00Z',
    verdict_version: '0.4.0',
    run_id: 'test-run-1',
    hashes: {
      config: 'abc123def456',
      dataset: '111222333444',
      judge: '555666777888',
      models: { m1: 'aaaa1111bbbb', m2: 'cccc2222dddd' },
    },
    models: [
      { id: 'm1', model: 'qwen2.5:7b', provider: 'ollama', base_url: 'http://localhost:11434/v1' },
      { id: 'm2', model: 'haiku', provider: undefined, base_url: 'https://openrouter.ai/api/v1' },
    ],
    judge: { model: 'qwen2.5:7b', rubric: {} },
    packs: ['./eval-packs/general.yaml'],
    case_count: 1,
    hardware: { platform: 'darwin', arch: 'arm64', node_version: 'v20.0.0', cpu_count: 8, total_memory_gb: 24 },
    repro_command: 'verdict run -c verdict.yaml --tier 24gb',
  }
}

describe('renderShareHtml', () => {
  it('includes the run name, run id, and timestamp', () => {
    const html = renderShareHtml({ result: makeResult(), receipt: null })
    expect(html).toContain('My Evals')
    expect(html).toContain('test-run-1')
    expect(html).toContain('2026-05-21T00:00:00Z')
  })

  it('ranks the winner first and shows the verdict banner', () => {
    const html = renderShareHtml({ result: makeResult(), receipt: null })
    expect(html).toContain('Verdict · winner')
    // Winner is m1 (9.2 > 8.1)
    const m1Idx = html.indexOf('>m1<')
    const m2Idx = html.indexOf('>m2<')
    expect(m1Idx).toBeGreaterThan(0)
    expect(m2Idx).toBeGreaterThan(m1Idx)
  })

  it('marks free models distinctly from paid', () => {
    const html = renderShareHtml({ result: makeResult(), receipt: null })
    expect(html).toContain('free')
    expect(html).toContain('$0.0500')
  })

  it('renders the receipt block when receipt is present', () => {
    const html = renderShareHtml({ result: makeResult(), receipt: makeReceipt() })
    expect(html).toContain('Reproducibility receipt')
    expect(html).toContain('abc123def456') // config hash
    expect(html).toContain('111222333444') // dataset hash
    expect(html).toContain('verdict run -c verdict.yaml --tier 24gb')
    expect(html).toContain('darwin arm64')
  })

  it('omits the receipt block when receipt is null', () => {
    const html = renderShareHtml({ result: makeResult(), receipt: null })
    expect(html).not.toContain('Reproducibility receipt')
  })

  it('REDACTS base_url from the rendered receipt models', () => {
    const html = renderShareHtml({ result: makeResult(), receipt: makeReceipt() })
    expect(html).not.toContain('http://localhost:11434/v1')
    expect(html).not.toContain('https://openrouter.ai')
  })

  it('escapes HTML in model names and prompt content', () => {
    const result = makeResult()
    result.name = '<script>alert(1)</script>'
    const html = renderShareHtml({ result, receipt: null })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('emits a complete HTML document with <!doctype html>', () => {
    const html = renderShareHtml({ result: makeResult(), receipt: null })
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('</html>')
  })

  it('handles a result with empty summary gracefully', () => {
    const empty = makeResult({ summary: {} })
    const html = renderShareHtml({ result: empty, receipt: null })
    // Should still produce a valid document — just no winner banner / no rows
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).not.toContain('Verdict · winner')
  })
})
