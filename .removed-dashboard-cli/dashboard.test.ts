import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { aggregateResults, validateDashboardData } from '../dashboard.js'
import type { DashboardData } from '../dashboard.js'

describe('dashboard', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-dashboard-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function writeResult(filename: string, data: unknown): void {
    fs.writeFileSync(path.join(tmpDir, filename), JSON.stringify(data))
  }

  const makeResult = (overrides: Record<string, unknown> = {}) => ({
    run_id: '2026-03-30T00-00-00',
    name: 'Test Run',
    timestamp: '2026-03-30T00:00:00.000Z',
    models: ['model-a', 'model-b'],
    cases: [
      {
        case_id: 'test-001',
        prompt: 'Hello world',
        criteria: 'Be helpful',
        responses: {
          'model-a': { model_id: 'model-a', text: 'Hi there!', input_tokens: 10, output_tokens: 5, latency_ms: 100 },
          'model-b': { model_id: 'model-b', text: 'Hello!', input_tokens: 10, output_tokens: 3, latency_ms: 200 },
        },
        scores: {
          'model-a': { accuracy: 8, completeness: 7, conciseness: 9, total: 8.0, reasoning: 'Good response' },
          'model-b': { accuracy: 7, completeness: 6, conciseness: 8, total: 7.0, reasoning: 'OK response' },
        },
        winner: 'model-a',
      },
    ],
    summary: {
      'model-a': { model_id: 'model-a', avg_total: 8.0, avg_accuracy: 8, avg_completeness: 7, avg_conciseness: 9, avg_latency_ms: 100, avg_tokens_per_sec: 50, total_cost_usd: 0, win_rate: 1, wins: 1, cases_run: 1, avg_solve_rate: 0 },
      'model-b': { model_id: 'model-b', avg_total: 7.0, avg_accuracy: 7, avg_completeness: 6, avg_conciseness: 8, avg_latency_ms: 200, avg_tokens_per_sec: 15, total_cost_usd: 0, win_rate: 0, wins: 0, cases_run: 1, avg_solve_rate: 0 },
    },
    ...overrides,
  })

  describe('aggregateResults', () => {
    it('aggregates a single result file', () => {
      writeResult('run1.json', makeResult())
      const data = aggregateResults(tmpDir, ['run1.json'])

      expect(data.meta.total_runs).toBe(1)
      expect(data.meta.total_cases).toBe(1)
      expect(data.meta.total_models).toBe(2)
      expect(data.meta.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Object.keys(data.models)).toEqual(['model-a', 'model-b'])
      expect(data.models['model-a'].name).toBe('model-a')
      expect(data.cases).toHaveLength(1)
      expect(data.cases[0].id).toBe('test-001')
      expect(data.cases[0].runs).toHaveLength(1)
      expect(data.cases[0].runs[0].run_id).toBe('2026-03-30T00-00-00')
      expect(data.cases[0].runs[0].scores['model-a'].total).toBe(8.0)
      expect(data.cases[0].runs[0].responses['model-a'].latency_ms).toBe(100)
    })

    it('aggregates multiple result files', () => {
      writeResult('run1.json', makeResult({
        run_id: 'run-1',
      }))
      writeResult('run2.json', makeResult({
        run_id: 'run-2',
        cases: [
          {
            case_id: 'test-002',
            prompt: 'Another test',
            criteria: 'Be concise',
            responses: {
              'model-a': { model_id: 'model-a', text: 'Short', input_tokens: 5, output_tokens: 1, latency_ms: 50 },
            },
            scores: {
              'model-a': { accuracy: 9, completeness: 8, conciseness: 10, total: 9.0, reasoning: 'Great' },
            },
          },
        ],
      }))

      const data = aggregateResults(tmpDir, ['run1.json', 'run2.json'])

      expect(data.meta.total_runs).toBe(2)
      expect(data.meta.total_cases).toBe(2)
      expect(data.cases.map(c => c.id).sort()).toEqual(['test-001', 'test-002'])
    })

    it('merges runs for the same case across files', () => {
      writeResult('run1.json', makeResult({ run_id: 'run-1' }))
      writeResult('run2.json', makeResult({ run_id: 'run-2' }))

      const data = aggregateResults(tmpDir, ['run1.json', 'run2.json'])

      // Same case_id appears in both files, should have 2 runs
      expect(data.meta.total_cases).toBe(1)
      expect(data.cases[0].runs).toHaveLength(2)
      expect(data.cases[0].runs.map(r => r.run_id).sort()).toEqual(['run-1', 'run-2'])
    })

    it('skips invalid JSON files gracefully', () => {
      fs.writeFileSync(path.join(tmpDir, 'bad.json'), 'not valid json')
      writeResult('good.json', makeResult())

      const data = aggregateResults(tmpDir, ['bad.json', 'good.json'])

      expect(data.meta.total_runs).toBe(1)
      expect(data.cases).toHaveLength(1)
    })

    it('derives suite from eval_pack file', () => {
      writeResult('run1.json', makeResult({
        eval_pack: { file: 'eval-packs/python-coding.yaml', total_cases: 10 },
      }))

      const data = aggregateResults(tmpDir, ['run1.json'])
      expect(data.cases[0].suite).toBe('python coding')
    })

    it('falls back to result name for suite when no eval_pack', () => {
      writeResult('run1.json', makeResult({ name: 'My Benchmark' }))

      const data = aggregateResults(tmpDir, ['run1.json'])
      expect(data.cases[0].suite).toBe('My Benchmark')
    })

    it('preserves full prompt and response text', () => {
      writeResult('run1.json', makeResult())

      const data = aggregateResults(tmpDir, ['run1.json'])
      expect(data.cases[0].prompt).toBe('Hello world')
      expect(data.cases[0].runs[0].responses['model-a'].text).toBe('Hi there!')
    })

    it('preserves judge reasoning', () => {
      writeResult('run1.json', makeResult())

      const data = aggregateResults(tmpDir, ['run1.json'])
      expect(data.cases[0].runs[0].scores['model-a'].reasoning).toBe('Good response')
    })
  })

  describe('validateDashboardData', () => {
    function validData(): DashboardData {
      return {
        meta: { total_runs: 1, total_cases: 1, total_models: 1, last_updated: '2026-03-30' },
        models: { 'model-a': { name: 'Model A' } },
        cases: [
          {
            id: 'test-001',
            name: 'Test',
            suite: 'general',
            prompt: 'Hello',
            runs: [
              {
                run_id: 'run-1',
                responses: { 'model-a': { text: 'Hi', latency_ms: 100 } },
                scores: { 'model-a': { total: 8.0, reasoning: 'Good' } },
              },
            ],
          },
        ],
      }
    }

    it('validates correct data with no errors', () => {
      expect(validateDashboardData(validData())).toEqual([])
    })

    it('reports missing meta', () => {
      const data = validData() as Record<string, unknown>
      delete data.meta
      const errors = validateDashboardData(data)
      expect(errors.some(e => e.includes('meta'))).toBe(true)
    })

    it('reports missing models', () => {
      const data = validData() as Record<string, unknown>
      delete data.models
      const errors = validateDashboardData(data)
      expect(errors.some(e => e.includes('models'))).toBe(true)
    })

    it('reports missing cases', () => {
      const data = validData() as Record<string, unknown>
      delete data.cases
      const errors = validateDashboardData(data)
      expect(errors.some(e => e.includes('cases'))).toBe(true)
    })

    it('reports non-object input', () => {
      expect(validateDashboardData(null)).toEqual(['Data must be a JSON object'])
      expect(validateDashboardData('string')).toEqual(['Data must be a JSON object'])
    })

    it('reports invalid meta fields', () => {
      const data = validData()
      ;(data.meta as Record<string, unknown>).total_runs = 'not a number'
      const errors = validateDashboardData(data)
      expect(errors.some(e => e.includes('total_runs'))).toBe(true)
    })

    it('reports missing case id', () => {
      const data = validData()
      delete (data.cases[0] as Record<string, unknown>).id
      const errors = validateDashboardData(data)
      expect(errors.some(e => e.includes('cases[0].id'))).toBe(true)
    })

    it('reports missing run fields', () => {
      const data = validData()
      delete (data.cases[0].runs[0] as Record<string, unknown>).run_id
      const errors = validateDashboardData(data)
      expect(errors.some(e => e.includes('run_id'))).toBe(true)
    })

    it('reports model without name', () => {
      const data = validData()
      ;(data.models as Record<string, unknown>)['model-a'] = { }
      const errors = validateDashboardData(data)
      expect(errors.some(e => e.includes('name'))).toBe(true)
    })
  })
})
