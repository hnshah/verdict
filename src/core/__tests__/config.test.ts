/**
 * Config + EvalPack loader tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadConfig, loadEvalPack, loadJsonlCases } from '../config.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-config-test-'))
}

function writeFile(dir: string, filename: string, content: string): string {
  const fullPath = path.join(dir, filename)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf8')
  return fullPath
}

// ─── loadConfig ───────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  let dir: string

  beforeEach(() => { dir = makeTempDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true }) })

  it('throws when file does not exist', () => {
    expect(() => loadConfig(path.join(dir, 'missing.yaml')))
      .toThrow(/Config not found/)
  })

  it('loads a minimal valid config', () => {
    const configPath = writeFile(dir, 'verdict.yaml', `
name: Test Config
models:
  - id: local
    model: gpt-4o-mini
    api_key: sk-test
judge:
  model: gpt-4o-mini
`)
    const config = loadConfig(configPath)
    expect(config.name).toBe('Test Config')
    expect(config.models).toHaveLength(1)
    expect(config.models[0].id).toBe('local')
    expect(config.judge.model).toBe('gpt-4o-mini')
  })

  it('applies default values', () => {
    const configPath = writeFile(dir, 'verdict.yaml', `
models:
  - id: local
    model: gpt-4o-mini
    api_key: sk-test
judge:
  model: gpt-4o-mini
`)
    const config = loadConfig(configPath)
    expect(config.name).toBe('My Evals')
    expect(config.run.concurrency).toBe(3)
    expect(config.run.retries).toBe(2)
    expect(config.output.dir).toBe('./results')
  })

  it('resolves ollama provider to base_url', () => {
    const configPath = writeFile(dir, 'verdict.yaml', `
models:
  - id: ollama-llama3
    provider: ollama
    model: llama3
judge:
  model: gpt-4o-mini
`)
    const config = loadConfig(configPath)
    const model = config.models[0]
    expect(model.base_url).toMatch(/^http:\/\/.*:11434\/v1$/)
    expect(model.api_key).toBe('none')
  })

  it('resolves mlx provider to localhost base_url', () => {
    const configPath = writeFile(dir, 'verdict.yaml', `
models:
  - id: mlx-model
    provider: mlx
    model: mlx-community/Meta-Llama-3-8B-Instruct-4bit
judge:
  model: gpt-4o-mini
`)
    const config = loadConfig(configPath)
    const model = config.models[0]
    expect(model.base_url).toMatch(/^http:\/\/localhost:\d+\/v1$/)
  })

  it('resolves environment variables in config', () => {
    process.env['TEST_API_KEY_VERDICT'] = 'sk-from-env'
    const configPath = writeFile(dir, 'verdict.yaml', `
models:
  - id: cloud
    model: gpt-4o-mini
    api_key: \${TEST_API_KEY_VERDICT}
judge:
  model: gpt-4o-mini
`)
    const config = loadConfig(configPath)
    expect(config.models[0].api_key).toBe('sk-from-env')
    delete process.env['TEST_API_KEY_VERDICT']
  })

  it('uses fallback when env var is unset', () => {
    delete process.env['UNSET_KEY_VERDICT']
    const configPath = writeFile(dir, 'verdict.yaml', `
models:
  - id: cloud
    model: gpt-4o-mini
    api_key: \${UNSET_KEY_VERDICT:-sk-fallback}
judge:
  model: gpt-4o-mini
`)
    const config = loadConfig(configPath)
    expect(config.models[0].api_key).toBe('sk-fallback')
  })

  it('throws on invalid config (missing models)', () => {
    const configPath = writeFile(dir, 'verdict.yaml', `
name: Bad Config
judge:
  model: gpt-4o-mini
`)
    expect(() => loadConfig(configPath)).toThrow(/Invalid config/)
  })
})

// ─── loadJsonlCases ───────────────────────────────────────────────────────────

describe('loadJsonlCases', () => {
  let dir: string

  beforeEach(() => { dir = makeTempDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('parses valid JSONL file', () => {
    const p = writeFile(dir, 'cases.jsonl', [
      '{"id": "c1", "prompt": "Hello", "criteria": "Be nice"}',
      '{"id": "c2", "prompt": "World", "criteria": "Be helpful", "scorer": "exact", "expected": "test"}',
    ].join('\n'))
    const cases = loadJsonlCases(p)
    expect(cases).toHaveLength(2)
    expect(cases[0].id).toBe('c1')
    expect(cases[1].scorer).toBe('exact')
  })

  it('skips blank lines', () => {
    const p = writeFile(dir, 'cases.jsonl', [
      '{"id": "c1", "prompt": "Hello", "criteria": "Be nice"}',
      '',
      '  ',
      '{"id": "c2", "prompt": "World", "criteria": "Be helpful"}',
    ].join('\n'))
    const cases = loadJsonlCases(p)
    expect(cases).toHaveLength(2)
  })

  it('skips comment lines starting with //', () => {
    const p = writeFile(dir, 'cases.jsonl', [
      '// This is a comment',
      '{"id": "c1", "prompt": "Hello", "criteria": "Be nice"}',
      '  // Another comment',
      '{"id": "c2", "prompt": "World", "criteria": "Be helpful"}',
    ].join('\n'))
    const cases = loadJsonlCases(p)
    expect(cases).toHaveLength(2)
  })

  it('throws on invalid JSON', () => {
    const p = writeFile(dir, 'bad.jsonl', 'not json\n')
    expect(() => loadJsonlCases(p)).toThrow('Invalid JSON at')
    expect(() => loadJsonlCases(p)).toThrow('line 1')
  })

  it('throws on invalid eval case schema', () => {
    const p = writeFile(dir, 'bad-schema.jsonl', '{"id": "c1"}\n')
    expect(() => loadJsonlCases(p)).toThrow('Invalid eval case at')
    expect(() => loadJsonlCases(p)).toThrow('line 1')
  })

  it('applies defaults for optional fields', () => {
    const p = writeFile(dir, 'defaults.jsonl',
      '{"id": "c1", "prompt": "Hello", "criteria": "Test"}\n')
    const cases = loadJsonlCases(p)
    expect(cases[0].scorer).toBe('llm')
    expect(cases[0].tags).toEqual([])
  })
})

// ─── loadEvalPack ─────────────────────────────────────────────────────────────

describe('loadEvalPack', () => {
  let dir: string

  beforeEach(() => { dir = makeTempDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true }) })

  it('throws when pack file does not exist', () => {
    expect(() => loadEvalPack('missing.yaml', dir))
      .toThrow(/Eval pack not found/)
  })

  it('loads a minimal eval pack', () => {
    const packPath = writeFile(dir, 'test.yaml', `
name: Test Pack
cases:
  - id: case-1
    prompt: What is 2+2?
    criteria: Returns the correct numeric answer
    expected: "4"
    scorer: exact
`)
    const pack = loadEvalPack(packPath, dir)
    expect(pack.name).toBe('Test Pack')
    expect(pack.cases).toHaveLength(1)
    expect(pack.cases[0].id).toBe('case-1')
    expect(pack.cases[0].scorer).toBe('exact')
  })

  it('loads a pack with multiple scorers', () => {
    const packPath = writeFile(dir, 'multi.yaml', `
name: Multi Scorer Pack
cases:
  - id: json-case
    prompt: Return JSON with a key
    criteria: Valid JSON output
    scorer: json
  - id: contains-case
    prompt: Mention the number 42
    criteria: Response contains 42
    expected: "42"
    scorer: contains
  - id: mc-case
    prompt: What is the capital of France?
    criteria: Correct letter choice
    expected: B
    choices: [London, Paris, Berlin, Madrid]
    scorer: multiple_choice
`)
    const pack = loadEvalPack(packPath, dir)
    expect(pack.cases).toHaveLength(3)
    expect(pack.cases[0].scorer).toBe('json')
    expect(pack.cases[1].scorer).toBe('contains')
    expect(pack.cases[2].scorer).toBe('multiple_choice')
    expect(pack.cases[2].choices).toHaveLength(4)
  })

  it('resolves relative image paths', () => {
    const imgPath = path.join(dir, 'test-image.png')
    fs.writeFileSync(imgPath, Buffer.from([0x89, 0x50, 0x4E, 0x47]))
    const packPath = writeFile(dir, 'vision.yaml', `
name: Vision Pack
cases:
  - id: vision-case
    prompt: Describe this image
    criteria: Accurate description
    image: test-image.png
    scorer: llm
`)
    const pack = loadEvalPack(packPath, dir)
    expect(pack.cases[0].image).toBe(path.resolve(dir, 'test-image.png'))
  })

  it('leaves http image URLs as-is', () => {
    const packPath = writeFile(dir, 'remote.yaml', `
name: Remote Pack
cases:
  - id: remote-img
    prompt: Describe this image
    criteria: Accurate description
    image: https://example.com/image.png
    scorer: llm
`)
    const pack = loadEvalPack(packPath, dir)
    expect(pack.cases[0].image).toBe('https://example.com/image.png')
  })

  it('resolves absolute path correctly', () => {
    const absPackPath = writeFile(dir, 'abs.yaml', `
name: Abs Pack
cases:
  - id: case-abs
    prompt: Test
    criteria: Test
    scorer: llm
`)
    const pack = loadEvalPack(absPackPath, '/some/other/dir')
    expect(pack.name).toBe('Abs Pack')
  })

  it('throws on invalid pack schema', () => {
    const packPath = writeFile(dir, 'bad.yaml', `
name: Bad Pack
cases:
  - prompt: missing id field
    criteria: Test
`)
    expect(() => loadEvalPack(packPath, dir)).toThrow(/Invalid eval pack/)
  })
})

// ─── loadEvalPack with JSONL dataset ─────────────────────────────────────────

describe('loadEvalPack with dataset', () => {
  let dir: string

  beforeEach(() => { dir = makeTempDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('loads cases from JSONL dataset', () => {
    writeFile(dir, 'cases.jsonl', [
      '{"id": "c1", "prompt": "Hello", "criteria": "Be nice"}',
      '{"id": "c2", "prompt": "World", "criteria": "Be helpful"}',
    ].join('\n'))
    const packPath = writeFile(dir, 'pack.yaml', [
      'name: Test Pack',
      'dataset: ./cases.jsonl',
      'cases: []',
    ].join('\n'))

    const pack = loadEvalPack(packPath, dir)
    expect(pack.cases).toHaveLength(2)
    expect(pack.cases[0].id).toBe('c1')
    expect(pack.cases[1].id).toBe('c2')
  })

  it('merges inline cases with dataset cases', () => {
    writeFile(dir, 'cases.jsonl',
      '{"id": "ds1", "prompt": "From dataset", "criteria": "Test"}\n')
    const packPath = writeFile(dir, 'pack.yaml', [
      'name: Merged Pack',
      'dataset: ./cases.jsonl',
      'cases:',
      '  - id: inline1',
      '    prompt: From inline',
      '    criteria: Test',
    ].join('\n'))

    const pack = loadEvalPack(packPath, dir)
    expect(pack.cases).toHaveLength(2)
    expect(pack.cases[0].id).toBe('inline1')
    expect(pack.cases[1].id).toBe('ds1')
  })

  it('throws when dataset file not found', () => {
    const packPath = writeFile(dir, 'pack.yaml', [
      'name: Missing Dataset',
      'dataset: ./nonexistent.jsonl',
      'cases: []',
    ].join('\n'))

    expect(() => loadEvalPack(packPath, dir)).toThrow('Dataset file not found')
  })

  it('works without dataset field (backward compatible)', () => {
    const packPath = writeFile(dir, 'pack.yaml', [
      'name: No Dataset',
      'cases:',
      '  - id: c1',
      '    prompt: Hello',
      '    criteria: Test',
    ].join('\n'))

    const pack = loadEvalPack(packPath, dir)
    expect(pack.cases).toHaveLength(1)
    expect(pack.dataset).toBeUndefined()
  })
})
