import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { validateConfig } from '../validate.js'

describe('validate command', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-validate-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function writeConfig(name: string, content: string): string {
    const p = path.join(tmpDir, name)
    fs.writeFileSync(p, content)
    return p
  }

  it('returns error for missing config file', () => {
    const result = validateConfig('/nonexistent/verdict.yaml')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('not found')
  })

  it('returns error for invalid YAML syntax', () => {
    const p = writeConfig('bad.yaml', '{ invalid yaml: [')
    const result = validateConfig(p)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('YAML syntax error')
  })

  it('returns schema errors for missing required fields', () => {
    const p = writeConfig('empty.yaml', 'name: test\n')
    const result = validateConfig(p)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('models'))).toBe(true)
  })

  it('validates a correct config', () => {
    const packPath = writeConfig('pack.yaml', `
name: Test Pack
cases:
  - id: case1
    prompt: Hello
    criteria: Be helpful
    scorer: exact
    expected: Hi
`)
    const relPack = path.relative(tmpDir, packPath)
    const configPath = writeConfig('verdict.yaml', `
name: Test
models:
  - id: test-model
    model: test-model
    provider: ollama
judge:
  model: test-model
packs:
  - ./${relPack}
`)
    const result = validateConfig(configPath)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.summary.models).toBe(1)
    expect(result.summary.packs).toBe(1)
    expect(result.summary.scorers.has('exact')).toBe(true)
  })

  it('reports error when model has no provider or base_url', () => {
    const configPath = writeConfig('verdict.yaml', `
name: Test
models:
  - id: bare-model
    model: bare-model
judge:
  model: bare-model
packs: []
`)
    const result = validateConfig(configPath)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('base_url'))).toBe(true)
  })

  it('reports error when judge model is not in models list', () => {
    const configPath = writeConfig('verdict.yaml', `
name: Test
models:
  - id: model-a
    model: model-a
    provider: ollama
judge:
  model: nonexistent-judge
packs: []
`)
    const result = validateConfig(configPath)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('nonexistent-judge'))).toBe(true)
  })

  it('reports error for missing eval pack file', () => {
    const configPath = writeConfig('verdict.yaml', `
name: Test
models:
  - id: m1
    model: m1
    provider: ollama
judge:
  model: m1
packs:
  - ./does-not-exist.yaml
`)
    const result = validateConfig(configPath)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('not found'))).toBe(true)
  })

  it('accepts a valid version field', () => {
    const configPath = writeConfig('verdict.yaml', `
version: "0.0"
name: Test
models:
  - id: m1
    model: m1
    provider: ollama
judge:
  model: m1
packs: []
`)
    const result = validateConfig(configPath)
    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('rejects invalid version format', () => {
    const configPath = writeConfig('verdict.yaml', `
version: "1.0.0"
name: Test
models:
  - id: m1
    model: m1
    provider: ollama
judge:
  model: m1
packs: []
`)
    const result = validateConfig(configPath)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('version'))).toBe(true)
  })

  it('warns when config version major differs from package major', () => {
    const configPath = writeConfig('verdict.yaml', `
version: "99.0"
name: Test
models:
  - id: m1
    model: m1
    provider: ollama
judge:
  model: m1
packs: []
`)
    const result = validateConfig(configPath)
    expect(result.valid).toBe(true)
    expect(result.warnings.some(w => w.includes('may not be compatible'))).toBe(true)
  })

  it('reports error for invalid eval pack schema', () => {
    const packPath = writeConfig('bad-pack.yaml', `
name: Bad Pack
cases:
  - id: case1
`)
    const relPack = path.relative(tmpDir, packPath)
    const configPath = writeConfig('verdict.yaml', `
name: Test
models:
  - id: m1
    model: m1
    provider: ollama
judge:
  model: m1
packs:
  - ./${relPack}
`)
    const result = validateConfig(configPath)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Pack'))).toBe(true)
  })
})
