import { describe, it, expect } from 'vitest'
import { generateBadge, generateStaticBadge } from '../badge.js'
import type { RunResult, ModelSummary } from '../../types/index.js'

function ms(id: string, avg: number, cost = 0): ModelSummary {
  return {
    model_id: id, avg_total: avg, avg_accuracy: avg, avg_completeness: avg,
    avg_conciseness: avg, avg_latency_ms: 1000, avg_tokens_per_sec: 30,
    total_cost_usd: cost, win_rate: 50, wins: 5, cases_run: 10, avg_solve_rate: 0.5,
  }
}

function runWith(models: ModelSummary[]): RunResult {
  return {
    run_id: 'r1', name: 't', timestamp: '2026-05-19T00:00:00.000Z',
    models: models.map(m => m.model_id), cases: [],
    summary: Object.fromEntries(models.map(m => [m.model_id, m])),
  }
}

describe('generateBadge', () => {
  it('emits well-formed SVG with both text elements', () => {
    const svg = generateBadge(runWith([ms('alpha', 8.7)]))
    expect(svg).toMatch(/^<svg /)
    expect(svg).toMatch(/<\/svg>$/)
    expect(svg).toContain('verdict')
    expect(svg).toContain('8.7/10')
  })

  it('colors green for scores >= 8', () => {
    const svg = generateBadge(runWith([ms('alpha', 8.5)]))
    expect(svg).toMatch(/#65a30d|#22c55e/)
  })

  it('colors red for scores < 5', () => {
    const svg = generateBadge(runWith([ms('alpha', 4.2)]))
    expect(svg).toContain('#dc2626')
  })

  it('colors yellow for scores 6-7', () => {
    const svg = generateBadge(runWith([ms('alpha', 6.5)]))
    expect(svg).toContain('#eab308')
  })

  it('honors --show-model option', () => {
    const svg = generateBadge(runWith([ms('qwen2.5:7b', 8.7)]), { showModel: true })
    expect(svg).toContain('qwen2.5:7b 8.7')
  })

  it('honors custom label', () => {
    const svg = generateBadge(runWith([ms('alpha', 8.0)]), { label: 'my-eval' })
    expect(svg).toContain('my-eval')
  })

  it('handles empty result by showing 0.0/10', () => {
    const svg = generateBadge(runWith([]))
    expect(svg).toContain('0.0/10')
    expect(svg).toContain('#dc2626') // red
  })

  it('escapes HTML/XML in label and value', () => {
    const svg = generateStaticBadge('a<b', '1&2>', '#000')
    expect(svg).toContain('a&lt;b')
    expect(svg).toContain('1&amp;2&gt;')
  })

  it('generateStaticBadge accepts arbitrary colour', () => {
    const svg = generateStaticBadge('foo', 'bar', '#abcdef')
    expect(svg).toContain('#abcdef')
  })
})
