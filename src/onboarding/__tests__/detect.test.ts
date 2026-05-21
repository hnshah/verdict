import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Hoisted mocks for the upstream provider modules — the probes call into
// them, but for a unit test we want to control their answers.
vi.mock('../../providers/ollama.js', () => ({
  isOllamaRunning: vi.fn(),
  listOllamaModels: vi.fn(),
  discoverOllama: vi.fn(async () => []),
}))
vi.mock('../../providers/mlx.js', () => ({
  isMLXRunning: vi.fn(),
  discoverMLX: vi.fn(async () => []),
}))
vi.mock('../../providers/lmstudio.js', () => ({
  isLMStudioRunning: vi.fn(),
  discoverLMStudio: vi.fn(async () => []),
}))

let detectMod: typeof import('../detect.js')
let ollama: typeof import('../../providers/ollama.js')
let mlx: typeof import('../../providers/mlx.js')
let lmstudio: typeof import('../../providers/lmstudio.js')

beforeEach(async () => {
  vi.resetModules()
  detectMod = await import('../detect.js')
  ollama = await import('../../providers/ollama.js')
  mlx = await import('../../providers/mlx.js')
  lmstudio = await import('../../providers/lmstudio.js')
  vi.mocked(ollama.isOllamaRunning).mockResolvedValue(false)
  vi.mocked(ollama.listOllamaModels).mockResolvedValue([])
  vi.mocked(mlx.isMLXRunning).mockResolvedValue(false)
  vi.mocked(lmstudio.isLMStudioRunning).mockResolvedValue(false)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('detect()', () => {
  it('returns a structurally complete snapshot even when nothing is installed', async () => {
    // Use a tempdir as cwd so probeConfig sees no verdict.yaml.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-detect-'))
    const prevCwd = process.cwd()
    process.chdir(tmp)
    try {
      const snap = await detectMod.detect({ probeTimeoutMs: 2000 })

      expect(snap.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(snap.hardware.cpuArch).toBe(os.arch())
      expect(snap.ollama.daemonRunning).toBe(false)
      expect(snap.ollama.installedModels).toEqual([])
      expect(snap.mlx.serverRunning).toBe(false)
      expect(snap.lmstudio.serverRunning).toBe(false)
      expect(snap.config.exists).toBe(false)
      expect(snap.network).toHaveProperty('online')
      expect(snap.homebrew).toHaveProperty('installed')
    } finally {
      process.chdir(prevCwd)
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('reads ollama daemon state from the mocked provider', async () => {
    vi.mocked(ollama.isOllamaRunning).mockResolvedValue(true)
    vi.mocked(ollama.listOllamaModels).mockResolvedValue(['qwen2.5:7b', 'llama3.2:3b'])
    const snap = await detectMod.detect({ probeTimeoutMs: 2000 })
    expect(snap.ollama.daemonRunning).toBe(true)
    expect(snap.ollama.installedModels).toEqual(['qwen2.5:7b', 'llama3.2:3b'])
  })

  it('reports cloud keys from process.env', async () => {
    const prev = process.env['OPENROUTER_API_KEY']
    process.env['OPENROUTER_API_KEY'] = 'sk-test'
    try {
      const snap = await detectMod.detect({ probeTimeoutMs: 2000 })
      expect(snap.cloud.openrouterKey).toBe(true)
      expect(snap.cloud.anthropicKey).toBe(false)
    } finally {
      if (prev === undefined) delete process.env['OPENROUTER_API_KEY']
      else process.env['OPENROUTER_API_KEY'] = prev
    }
  })

  it('reports a valid verdict.yaml as config.exists + valid', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-detect-cfg-'))
    const cfg = `version: "1.0"
name: t
models:
  - id: x
    provider: ollama
    model: qwen2.5:7b
judge:
  model: x
packs: [./eval-packs/general.yaml]
`
    fs.writeFileSync(path.join(tmp, 'verdict.yaml'), cfg)
    const prevCwd = process.cwd()
    process.chdir(tmp)
    try {
      const snap = await detectMod.detect({ probeTimeoutMs: 2000 })
      expect(snap.config.exists).toBe(true)
      expect(snap.config.valid).toBe(true)
      expect(snap.config.modelCount).toBe(1)
    } finally {
      process.chdir(prevCwd)
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('reports invalid verdict.yaml with issues', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-detect-bad-'))
    fs.writeFileSync(path.join(tmp, 'verdict.yaml'), 'not: a valid verdict config\n')
    const prevCwd = process.cwd()
    process.chdir(tmp)
    try {
      const snap = await detectMod.detect({ probeTimeoutMs: 2000 })
      expect(snap.config.exists).toBe(true)
      expect(snap.config.valid).toBe(false)
      expect(snap.config.issues.length).toBeGreaterThan(0)
    } finally {
      process.chdir(prevCwd)
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('fires onProgress at least once and ends with all-done', async () => {
    const calls: Array<Record<string, string>> = []
    await detectMod.detect({
      probeTimeoutMs: 2000,
      onProgress: p => calls.push({ ...p }),
    })
    expect(calls.length).toBeGreaterThan(0)
    const last = calls[calls.length - 1]!
    expect(Object.values(last).every(v => v === 'done')).toBe(true)
  })

  it('which() returns undefined for nonexistent binaries', () => {
    expect(detectMod.which('definitely-not-a-real-binary-xyz-123')).toBeUndefined()
  })
})
