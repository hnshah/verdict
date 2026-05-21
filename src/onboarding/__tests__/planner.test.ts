import { describe, expect, it } from 'vitest'
import { propose, type CatalogModel } from '../planner.js'
import { idFromModelName } from '../templates.js'
import type { Snapshot } from '../events.js'

const CATALOG: CatalogModel[] = [
  { name: 'llama3.2:3b', provider: 'ollama', params_b: 3, default_quant: 'q4_K_M', family: 'llama', tags: ['general', 'small'] },
  { name: 'qwen2.5:3b', provider: 'ollama', params_b: 3, default_quant: 'q4_K_M', family: 'qwen', tags: ['general', 'small'] },
  { name: 'qwen2.5:7b', provider: 'ollama', params_b: 7, default_quant: 'q4_K_M', family: 'qwen', tags: ['general'] },
  { name: 'qwen2.5-coder:7b', provider: 'ollama', params_b: 7, default_quant: 'q4_K_M', family: 'qwen', tags: ['coding'] },
  { name: 'llama3.1:8b', provider: 'ollama', params_b: 8, default_quant: 'q4_K_M', family: 'llama', tags: ['general'] },
  { name: 'mistral:7b', provider: 'ollama', params_b: 7, default_quant: 'q4_K_M', family: 'mistral', tags: ['general'] },
]

function baseSnapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    capturedAt: '2026-01-01T00:00:00.000Z',
    hardware: {
      cpu: 'M2',
      cpuCores: 8,
      cpuArch: 'arm64',
      ram: '32 GB',
      ramGB: 32,
      freeDiskGB: 100,
      os: 'macOS',
      osVersion: '15.0',
    },
    ollama: { installed: false, daemonRunning: false, installedModels: [] },
    mlx: { appleSilicon: true, mlxLmInstalled: false, serverRunning: false },
    lmstudio: { appInstalled: false, serverRunning: false },
    cloud: { openrouterKey: false, anthropicKey: false, openaiKey: false, groqKey: false },
    config: { exists: false, issues: [] },
    network: { online: true },
    homebrew: { installed: true },
    ...over,
  }
}

describe('propose', () => {
  it('config-only when verdict.yaml is valid and has models', () => {
    const plan = propose(
      baseSnapshot({
        config: { exists: true, valid: true, modelCount: 2, issues: [], path: './verdict.yaml' },
      }),
      { catalog: CATALOG }
    )
    expect(plan.intent).toBe('config-only')
    expect(plan.installSteps).toEqual([])
    expect(plan.modelsToPull).toEqual([])
    expect(plan.config.action).toBe('leave')
  })

  it('reuse-local when Ollama is running with installed models (Apple Silicon, no cloud key)', () => {
    const plan = propose(
      baseSnapshot({
        ollama: {
          installed: true,
          daemonRunning: true,
          installedModels: ['qwen2.5:7b'],
        },
      }),
      { catalog: CATALOG }
    )
    expect(plan.intent).toBe('reuse-local')
    expect(plan.reuseModels).toContain('qwen2.5:7b')
    expect(plan.installSteps).toEqual([])
    expect(plan.modelsToPull).toEqual([])
    // Judge id must match the slugified form the YAML writer uses, not the
    // raw Ollama model name — otherwise the eval runner can't resolve it.
    expect(plan.judge.modelId).toBe(idFromModelName('qwen2.5:7b'))
  })

  it('cloud-only when key present and nothing local', () => {
    const plan = propose(
      baseSnapshot({
        // simulate non-arm so the cloud-only branch fires unconditionally
        hardware: { ...baseSnapshot().hardware, cpuArch: 'x64' },
        cloud: { openrouterKey: true, anthropicKey: false, openaiKey: false, groqKey: false },
      }),
      { catalog: CATALOG }
    )
    expect(plan.intent).toBe('cloud-only')
    expect(plan.cloudModels.length).toBeGreaterThanOrEqual(2)
    expect(plan.modelsToPull).toEqual([])
    expect(plan.installSteps).toEqual([])
  })

  it('cloud-only also fires on Apple Silicon when no useful local runtime', () => {
    const plan = propose(
      baseSnapshot({
        // Apple Silicon by default but no Ollama installed, no MLX server, no LM Studio
        cloud: { openrouterKey: true, anthropicKey: false, openaiKey: false, groqKey: false },
      }),
      { catalog: CATALOG }
    )
    expect(plan.intent).toBe('cloud-only')
  })

  it('local-first on a fresh Apple Silicon machine: install + pull small + mid + coder', () => {
    const plan = propose(baseSnapshot(), { catalog: CATALOG })
    expect(plan.intent).toBe('local-first')
    // brew is present in the stub, so install step uses brew
    expect(plan.installSteps[0]).toMatchObject({
      id: 'install-ollama',
      method: 'brew',
    })
    expect(plan.installSteps.some(s => s.id === 'start-ollama')).toBe(true)
    expect(plan.modelsToPull.length).toBeGreaterThanOrEqual(2)
    // Includes a coder because ramGB is 32 (≥ 16)
    expect(plan.modelsToPull.some(m => m.role === 'coder')).toBe(true)
  })

  it('local-first uses curl install when brew is missing', () => {
    const plan = propose(
      baseSnapshot({ homebrew: { installed: false } }),
      { catalog: CATALOG }
    )
    expect(plan.installSteps[0]?.method).toBe('curl')
  })

  it('local-first skips coder on low-RAM machines', () => {
    const plan = propose(
      baseSnapshot({
        hardware: { ...baseSnapshot().hardware, ramGB: 8, ram: '8 GB' },
      }),
      { catalog: CATALOG }
    )
    expect(plan.intent).toBe('local-first')
    expect(plan.modelsToPull.some(m => m.role === 'coder')).toBe(false)
  })

  it('local-first uses family diversity (no two qwen models of the same size)', () => {
    const plan = propose(baseSnapshot(), { catalog: CATALOG })
    const families = plan.modelsToPull.map(m =>
      m.name.includes('qwen') ? 'qwen' : m.name.includes('llama') ? 'llama' : m.name.includes('mistral') ? 'mistral' : 'other'
    )
    // small (llama3.2:3b → llama) should be picked first; mid should NOT be a llama
    expect(families[0]).toBe('llama')
    // The mid pick should be a different family from the small pick.
    expect(families[1]).not.toBe('llama')
  })

  it('judge defaults to cloud mini when a key is present', () => {
    const plan = propose(
      baseSnapshot({
        cloud: { openrouterKey: true, anthropicKey: false, openaiKey: false, groqKey: false },
        ollama: { installed: true, daemonRunning: true, installedModels: ['qwen2.5:7b'] },
      }),
      { catalog: CATALOG }
    )
    // With both local + cloud, the reuse-local branch wins but should still pick cloud judge.
    expect(plan.intent).toBe('reuse-local')
    expect(plan.judge.modelId).toBe('cloud-mini')
  })

  it('local-first with no cloud key uses smallest local as self-judge (slugified id)', () => {
    const plan = propose(baseSnapshot(), { catalog: CATALOG })
    const smallest = [...plan.modelsToPull].sort((a, b) => a.paramsB - b.paramsB)[0]
    // Judge.modelId must equal the slug we write to verdict.yaml so that
    // runEvals() can look it up. Raw model names (with colons/dots) don't
    // match.
    expect(plan.judge.modelId).toBe(idFromModelName(smallest!.name))
  })

  it('estimatedDownloadGB sums planned models', () => {
    const plan = propose(baseSnapshot(), { catalog: CATALOG })
    const expected = plan.modelsToPull.reduce((s, m) => s + m.estimatedSizeGB, 0)
    expect(plan.estimatedDownloadGB).toBeCloseTo(+expected.toFixed(1), 1)
  })
})
