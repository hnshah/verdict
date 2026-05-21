import { describe, it, expect } from 'vitest'
import { computeReceipt, buildReproCommand, RECEIPT_VERSION } from '../receipt.js'
import type { Config, EvalPack } from '../../types/index.js'

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    name: 'Test',
    models: [
      { id: 'm1', model: 'qwen2.5:7b', provider: 'ollama', base_url: 'http://localhost:11434/v1', api_key: 'none', port: 8080, tags: [], timeout_ms: 120000, max_tokens: 1024 },
      { id: 'm2', model: 'llama3.1:8b', provider: 'ollama', base_url: 'http://localhost:11434/v1', api_key: 'none', port: 8080, tags: [], timeout_ms: 120000, max_tokens: 1024 },
    ],
    judge: { model: 'qwen2.5:7b', blind: true, strategy: 'single', rubric: { accuracy: 0.4, completeness: 0.4, conciseness: 0.2 } },
    packs: ['./eval-packs/general.yaml'],
    run: { concurrency: 3, retries: 2, cache: true },
    output: { dir: './results', formats: ['json', 'markdown'], delta: true },
    ...overrides,
  } as Config
}

function makePack(name: string, cases: Array<{ id: string; prompt: string; criteria?: string }>): EvalPack {
  return {
    name,
    cases: cases.map(c => ({
      id: c.id,
      prompt: c.prompt,
      criteria: c.criteria ?? '',
    })),
  } as unknown as EvalPack
}

describe('receipt', () => {
  describe('computeReceipt', () => {
    it('produces a well-formed receipt with all required fields', () => {
      const config = makeConfig()
      const packs = [makePack('p1', [{ id: 'c1', prompt: 'hi' }])]
      const r = computeReceipt({
        config,
        packs,
        runId: 'test-run-1',
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })

      expect(r.receipt_version).toBe(RECEIPT_VERSION)
      expect(r.run_id).toBe('test-run-1')
      expect(r.verdict_version).toBe('0.4.0')
      expect(r.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(r.case_count).toBe(1)
      expect(r.models.length).toBe(2)
      expect(r.judge.model).toBe('qwen2.5:7b')
      expect(r.hashes.config).toMatch(/^[0-9a-f]{12}$/)
      expect(r.hashes.dataset).toMatch(/^[0-9a-f]{12}$/)
      expect(r.hashes.judge).toMatch(/^[0-9a-f]{12}$/)
      expect(r.hashes.models['m1']).toMatch(/^[0-9a-f]{12}$/)
      expect(r.hardware.platform).toBeTruthy()
      expect(r.hardware.cpu_count).toBeGreaterThan(0)
      expect(r.hardware.total_memory_gb).toBeGreaterThan(0)
    })

    it('hashes are stable across identical inputs (modulo timestamp)', () => {
      const a = computeReceipt({
        config: makeConfig(),
        packs: [makePack('p', [{ id: 'c1', prompt: 'hello' }])],
        runId: 'r1',
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })
      const b = computeReceipt({
        config: makeConfig(),
        packs: [makePack('p', [{ id: 'c1', prompt: 'hello' }])],
        runId: 'r2', // different run id, but hashes should match
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })
      expect(a.hashes.config).toBe(b.hashes.config)
      expect(a.hashes.dataset).toBe(b.hashes.dataset)
      expect(a.hashes.judge).toBe(b.hashes.judge)
      expect(a.hashes.models['m1']).toBe(b.hashes.models['m1'])
    })

    it('dataset hash is stable across case-order permutations (sorted by id)', () => {
      const a = computeReceipt({
        config: makeConfig(),
        packs: [makePack('p', [
          { id: 'c1', prompt: 'hello' },
          { id: 'c2', prompt: 'world' },
        ])],
        runId: 'r1',
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })
      const b = computeReceipt({
        config: makeConfig(),
        packs: [makePack('p', [
          { id: 'c2', prompt: 'world' },
          { id: 'c1', prompt: 'hello' },
        ])],
        runId: 'r2',
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })
      expect(a.hashes.dataset).toBe(b.hashes.dataset)
    })

    it('dataset hash CHANGES when a case prompt changes', () => {
      const a = computeReceipt({
        config: makeConfig(),
        packs: [makePack('p', [{ id: 'c1', prompt: 'hello' }])],
        runId: 'r1',
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })
      const b = computeReceipt({
        config: makeConfig(),
        packs: [makePack('p', [{ id: 'c1', prompt: 'goodbye' }])],
        runId: 'r1',
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })
      expect(a.hashes.dataset).not.toBe(b.hashes.dataset)
    })

    it('model hash CHANGES when provider or base_url changes', () => {
      const baseConfig = makeConfig()
      const modConfig = makeConfig({
        models: [
          { ...baseConfig.models[0], provider: 'mlx', base_url: 'http://localhost:8080/v1' },
          baseConfig.models[1],
        ],
      })

      const a = computeReceipt({
        config: baseConfig,
        packs: [makePack('p', [{ id: 'c1', prompt: 'hello' }])],
        runId: 'r1',
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })
      const b = computeReceipt({
        config: modConfig,
        packs: [makePack('p', [{ id: 'c1', prompt: 'hello' }])],
        runId: 'r1',
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })
      expect(a.hashes.models['m1']).not.toBe(b.hashes.models['m1'])
      expect(a.hashes.config).not.toBe(b.hashes.config)
    })

    it('judge hash CHANGES when rubric weights change', () => {
      const baseConfig = makeConfig()
      const modConfig = makeConfig({
        judge: { ...baseConfig.judge, rubric: { accuracy: 0.6, completeness: 0.3, conciseness: 0.1 } },
      })
      const a = computeReceipt({
        config: baseConfig,
        packs: [makePack('p', [{ id: 'c1', prompt: 'hello' }])],
        runId: 'r1',
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })
      const b = computeReceipt({
        config: modConfig,
        packs: [makePack('p', [{ id: 'c1', prompt: 'hello' }])],
        runId: 'r1',
        verdictVersion: '0.4.0',
        reproCommand: 'verdict run',
      })
      expect(a.hashes.judge).not.toBe(b.hashes.judge)
    })
  })

  describe('buildReproCommand', () => {
    it('emits a minimal command with just --config', () => {
      expect(buildReproCommand('verdict.yaml', {})).toBe('verdict run -c verdict.yaml')
    })

    it('includes --pack when provided', () => {
      expect(buildReproCommand('v.yaml', { pack: 'foo' })).toContain('--pack foo')
    })

    it('includes --tier when provided', () => {
      expect(buildReproCommand('v.yaml', { tier: '24gb' })).toContain('--tier 24gb')
    })

    it('quotes --models since it can contain commas', () => {
      expect(buildReproCommand('v.yaml', { models: 'a,b' })).toContain('--models "a,b"')
    })

    it('joins --category with spaces (commander accepts repeatable)', () => {
      expect(buildReproCommand('v.yaml', { category: ['a', 'b'] })).toContain('--category a b')
    })
  })
})
