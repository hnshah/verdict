import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  commitConfigWrite,
  mergeYaml,
  planConfigWrite,
  unifiedDiff,
} from '../config-writer.js'
import {
  renderVerdictYamlFromPlan,
} from '../templates.js'
import type { Plan } from '../events.js'

const stubPlan = (over: Partial<Plan> = {}): Plan => ({
  intent: 'local-first',
  installSteps: [],
  modelsToPull: [
    { name: 'llama3.2:3b', provider: 'ollama', role: 'general-small', paramsB: 3, defaultQuant: 'q4_K_M', estimatedSizeGB: 1.5 },
    { name: 'qwen2.5:7b', provider: 'ollama', role: 'general-mid', paramsB: 7, defaultQuant: 'q4_K_M', estimatedSizeGB: 3.5 },
  ],
  cloudModels: [],
  reuseModels: [],
  judge: { modelId: 'llama3-2-3b', rationale: '' },
  config: { action: 'create', targetPath: './verdict.yaml' },
  rationale: '',
  estimatedDownloadGB: 5,
  estimatedDurationMin: [3, 8],
  ...over,
})

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-config-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('renderVerdictYamlFromPlan', () => {
  it('emits a valid-looking YAML with the planned models and judge', () => {
    const out = renderVerdictYamlFromPlan(stubPlan())
    expect(out).toContain('models:')
    expect(out).toContain('  - id: llama3-2-3b')
    expect(out).toContain('  - id: qwen2-5-7b')
    expect(out).toContain('judge:')
    expect(out).toContain('  model: llama3-2-3b')
  })

  it('includes cloud models with api_key env reference', () => {
    const out = renderVerdictYamlFromPlan(
      stubPlan({
        cloudModels: [
          { id: 'cloud-mini', base_url: 'https://openrouter.ai/api/v1', apiKeyEnv: 'OPENROUTER_API_KEY', model: 'anthropic/claude-haiku-3-5' },
        ],
      })
    )
    expect(out).toContain('cloud-mini')
    expect(out).toContain('api_key: "${OPENROUTER_API_KEY}"')
  })
})

describe('planConfigWrite', () => {
  it('reports no diff when target file does not exist', () => {
    const target = path.join(tmp, 'verdict.yaml')
    const wp = planConfigWrite(stubPlan({ config: { action: 'create', targetPath: target } }))
    expect(wp.hasExisting).toBe(false)
    expect(wp.diff).toBeNull()
    expect(wp.preview).toContain('models:')
  })

  it('produces a diff when target exists', () => {
    const target = path.join(tmp, 'verdict.yaml')
    fs.writeFileSync(target, 'version: "1.0"\nname: "Old"\nmodels: []\n')
    const wp = planConfigWrite(
      stubPlan({ config: { action: 'replace-with-backup', targetPath: target } })
    )
    expect(wp.hasExisting).toBe(true)
    expect(wp.diff).not.toBeNull()
    expect(wp.diff).toContain('+models:')
  })
})

describe('commitConfigWrite', () => {
  it('create: writes the file atomically (no .tmp lingers)', () => {
    const target = path.join(tmp, 'verdict.yaml')
    const plan = stubPlan({ config: { action: 'create', targetPath: target } })
    const wp = planConfigWrite(plan)
    const result = commitConfigWrite(plan, wp, { skipScaffold: true })
    expect(result.action).toBe('create')
    expect(fs.existsSync(target)).toBe(true)
    const lingering = fs.readdirSync(tmp).filter(f => f.endsWith('.tmp'))
    expect(lingering).toEqual([])
  })

  it('replace-with-backup: keeps a timestamped backup', () => {
    const target = path.join(tmp, 'verdict.yaml')
    fs.writeFileSync(target, 'old content')
    const plan = stubPlan({ config: { action: 'replace-with-backup', targetPath: target } })
    const wp = planConfigWrite(plan)
    const result = commitConfigWrite(plan, wp, { skipScaffold: true })
    expect(result.backupPath).toBeDefined()
    expect(fs.existsSync(result.backupPath!)).toBe(true)
    expect(fs.readFileSync(result.backupPath!, 'utf-8')).toBe('old content')
    expect(fs.readFileSync(target, 'utf-8')).toContain('models:')
  })

  it('leave: no-op when action is leave', () => {
    const target = path.join(tmp, 'verdict.yaml')
    fs.writeFileSync(target, 'preserved')
    const plan = stubPlan({ config: { action: 'leave', targetPath: target } })
    const wp = planConfigWrite(plan)
    const result = commitConfigWrite(plan, wp, { skipScaffold: true })
    expect(result.action).toBe('leave')
    expect(fs.readFileSync(target, 'utf-8')).toBe('preserved')
  })

  it('scaffold: writes eval-packs and .env.example next to the config', () => {
    const target = path.join(tmp, 'verdict.yaml')
    const plan = stubPlan({ config: { action: 'create', targetPath: target } })
    const wp = planConfigWrite(plan)
    commitConfigWrite(plan, wp)
    expect(fs.existsSync(path.join(tmp, 'eval-packs', 'general.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(tmp, 'eval-packs', 'moe.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(tmp, '.env.example'))).toBe(true)
  })

  it('merge: appends new models without touching existing ones', () => {
    const target = path.join(tmp, 'verdict.yaml')
    fs.writeFileSync(target, `version: "1.0"
name: "Existing"
models:
  - id: my-existing-one
    provider: ollama
    model: phi3:mini
    tags: [local, my-custom]
judge:
  model: my-existing-one
`)
    const plan = stubPlan({ config: { action: 'merge', targetPath: target } })
    const wp = planConfigWrite(plan)
    commitConfigWrite(plan, wp, { skipScaffold: true })
    const out = fs.readFileSync(target, 'utf-8')
    expect(out).toContain('my-existing-one')
    expect(out).toContain('my-custom')
    expect(out).toContain('llama3-2-3b')
    expect(out).toContain('qwen2-5-7b')
  })
})

describe('mergeYaml direct', () => {
  it('does nothing when all incoming ids already exist', () => {
    const existing = `models:
  - id: same
    provider: ollama
    model: x
judge:
  model: same
`
    const incoming = `models:
  - id: same
    provider: ollama
    model: x
judge:
  model: same
`
    expect(mergeYaml(existing, incoming)).toBe(existing)
  })
})

describe('unifiedDiff', () => {
  it('emits +/- markers for added/removed lines', () => {
    const d = unifiedDiff('a\nb\nc\n', 'a\nB\nc\n', 'demo')
    expect(d).toContain('--- demo (current)')
    expect(d).toContain('+++ demo (proposed)')
    expect(d).toContain('-b')
    expect(d).toContain('+B')
    expect(d).toContain(' a')
  })

  it('handles identical inputs (no +/- lines)', () => {
    const d = unifiedDiff('hello\nworld\n', 'hello\nworld\n', 'demo')
    expect(d.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'))).toEqual([])
    expect(d.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---'))).toEqual([])
  })
})
