import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { detectFields, importCommand } from '../import.js'

// ─── detectFields tests ───────────────────────────────────────────────────────

describe('detectFields', () => {
  it('detects question/answer (GSM8K pattern)', () => {
    const row = { question: 'What is 2+2?', answer: '#### 4' }
    const { inputField, outputField } = detectFields(row)
    expect(inputField).toBe('question')
    expect(outputField).toBe('answer')
  })

  it('detects prompt/completion pattern', () => {
    const row = { prompt: 'Tell me about AI', completion: 'AI is...' }
    const { inputField, outputField } = detectFields(row)
    expect(inputField).toBe('prompt')
    expect(outputField).toBe('completion')
  })

  it('detects input/output pattern', () => {
    const row = { input: 'Sort this list', output: '[1,2,3]', metadata: {} }
    const { inputField, outputField } = detectFields(row)
    expect(inputField).toBe('input')
    expect(outputField).toBe('output')
  })

  it('detects instruction/response pattern', () => {
    const row = { instruction: 'Translate to French', response: 'Bonjour' }
    const { inputField, outputField } = detectFields(row)
    expect(inputField).toBe('instruction')
    expect(outputField).toBe('response')
  })

  it('returns null for unknown fields', () => {
    const row = { foo: 'bar', baz: 'qux' }
    const { inputField, outputField } = detectFields(row)
    expect(inputField).toBeNull()
    expect(outputField).toBeNull()
  })

  it('handles empty row', () => {
    const { inputField, outputField } = detectFields({})
    expect(inputField).toBeNull()
    expect(outputField).toBeNull()
  })

  it('prioritizes question over text', () => {
    const row = { text: 'some text', question: 'a question', answer: 'yes' }
    const { inputField } = detectFields(row)
    expect(inputField).toBe('question')
  })

  it('detects query field', () => {
    const row = { query: 'Find me X', label: 'relevant' }
    const { inputField, outputField } = detectFields(row)
    expect(inputField).toBe('query')
    expect(outputField).toBe('label')
  })
})

// ─── importCommand tests ──────────────────────────────────────────────────────

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock ora
vi.mock('ora', () => ({
  default: () => ({
    start: () => ({ succeed: vi.fn(), fail: vi.fn(), stop: vi.fn() }),
    succeed: vi.fn(),
    fail: vi.fn(),
    stop: vi.fn(),
  }),
}))

function makeSplitsResponse(dataset: string) {
  return {
    splits: [
      { dataset, config: 'main', split: 'train' },
      { dataset, config: 'main', split: 'test' },
    ],
  }
}

function makeRowsResponse(rows: Record<string, unknown>[]) {
  return {
    rows: rows.map((row, idx) => ({ row_idx: idx, row, truncated_cells: [] })),
    num_rows_total: rows.length,
  }
}

const GSM8K_ROWS = [
  { question: "Janet's ducks lay 16 eggs per day. She eats 3. How much does she make selling the rest at $2 each?", answer: 'She sells 13 eggs.\n#### 26' },
  { question: 'A robe takes 2 bolts. Half as much white. Total?', answer: '3 bolts.\n#### 3' },
  { question: 'James has 3 children. Each needs 4 sets of clothes. Each costs $6. Total?', answer: '#### 72' },
]

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('importCommand', () => {
  it('exits with error when --hf is missing', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => { throw new Error('exit') })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(importCommand({ dryRun: true })).rejects.toThrow('exit')
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('dry run — does not write files', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => makeSplitsResponse('openai/gsm8k') })
      .mockResolvedValueOnce({ ok: true, json: async () => makeRowsResponse(GSM8K_ROWS) })

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-import-test-'))
    const outputPath = path.join(tmpDir, 'gsm8k-out.yaml')

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => { throw new Error('exit') })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(importCommand({
      hf: 'openai/gsm8k',
      split: 'test',
      max: 3,
      output: outputPath,
      dryRun: true,
    })).rejects.toThrow('exit')

    expect(fs.existsSync(outputPath)).toBe(false)
    mockExit.mockRestore()
  })

  it('writes yaml with correct structure for GSM8K', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => makeSplitsResponse('openai/gsm8k') })
      .mockResolvedValueOnce({ ok: true, json: async () => makeRowsResponse(GSM8K_ROWS) })

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-import-test-'))
    const outputPath = path.join(tmpDir, 'gsm8k.yaml')

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await importCommand({
      hf: 'openai/gsm8k',
      split: 'test',
      max: 3,
      output: outputPath,
    })

    expect(fs.existsSync(outputPath)).toBe(true)
    const content = fs.readFileSync(outputPath, 'utf8')
    expect(content).toContain('name:')
    expect(content).toContain('cases:')
    expect(content).toContain('gsm8k-test-0001')
    expect(content).toContain('prompt:')
  })

  it('strips #### markers from GSM8K answers', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => makeSplitsResponse('openai/gsm8k') })
      .mockResolvedValueOnce({ ok: true, json: async () => makeRowsResponse([GSM8K_ROWS[2]]) })

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-import-test-'))
    const outputPath = path.join(tmpDir, 'gsm8k-answer.yaml')

    vi.spyOn(console, 'log').mockImplementation(() => {})

    await importCommand({
      hf: 'openai/gsm8k',
      split: 'test',
      max: 1,
      output: outputPath,
    })

    const content = fs.readFileSync(outputPath, 'utf8')
    // Should have extracted just '72' from '#### 72'
    expect(content).toContain('72')
    expect(content).not.toContain('####')
  })

  it('uses --config to pick non-default HF config', async () => {
    const socialSplits = {
      splits: [
        { dataset: 'openai/gsm8k', config: 'socratic', split: 'train' },
        { dataset: 'openai/gsm8k', config: 'socratic', split: 'test' },
      ],
    }
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => socialSplits })
      .mockResolvedValueOnce({ ok: true, json: async () => makeRowsResponse(GSM8K_ROWS.slice(0, 1)) })

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-import-test-'))
    const outputPath = path.join(tmpDir, 'gsm8k-socratic.yaml')

    vi.spyOn(console, 'log').mockImplementation(() => {})

    await importCommand({
      hf: 'openai/gsm8k',
      config: 'socratic',
      split: 'test',
      max: 1,
      output: outputPath,
    })

    // Check that the second fetch used the correct config
    const secondCallUrl = mockFetch.mock.calls[1][0] as string
    expect(secondCallUrl).toContain('config=socratic')
    expect(secondCallUrl).toContain('split=test')
  })

  it('exits gracefully when split not found in config', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeSplitsResponse('openai/gsm8k'),
    })

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => { throw new Error('exit') })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(importCommand({
      hf: 'openai/gsm8k',
      split: 'validation',  // doesn't exist
      max: 5,
    })).rejects.toThrow('exit')

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  it('handles HuggingFace API error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => '{"error": "Not Found"}',
    })

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => { throw new Error('exit') })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(importCommand({
      hf: 'nonexistent/dataset',
      split: 'test',
      max: 5,
    })).rejects.toThrow('exit')

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  it('uses custom --criteria when provided', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => makeSplitsResponse('openai/gsm8k') })
      .mockResolvedValueOnce({ ok: true, json: async () => makeRowsResponse(GSM8K_ROWS.slice(0, 1)) })

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-import-test-'))
    const outputPath = path.join(tmpDir, 'custom-criteria.yaml')

    vi.spyOn(console, 'log').mockImplementation(() => {})

    await importCommand({
      hf: 'openai/gsm8k',
      split: 'test',
      max: 1,
      output: outputPath,
      criteria: 'Must show step-by-step reasoning',
    })

    const content = fs.readFileSync(outputPath, 'utf8')
    expect(content).toContain('Must show step-by-step reasoning')
  })

  it('includes source tags in cases', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => makeSplitsResponse('openai/gsm8k') })
      .mockResolvedValueOnce({ ok: true, json: async () => makeRowsResponse(GSM8K_ROWS.slice(0, 1)) })

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-import-test-'))
    const outputPath = path.join(tmpDir, 'tagged.yaml')

    vi.spyOn(console, 'log').mockImplementation(() => {})

    await importCommand({
      hf: 'openai/gsm8k',
      split: 'test',
      max: 1,
      output: outputPath,
    })

    const content = fs.readFileSync(outputPath, 'utf8')
    expect(content).toContain('source:huggingface')
    expect(content).toContain('dataset:openai/gsm8k')
    expect(content).toContain('split:test')
  })
})
