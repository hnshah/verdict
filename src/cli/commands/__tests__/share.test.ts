import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'

// Mock ora
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  }),
}))

// Mock chalk to return plain strings
vi.mock('chalk', () => ({
  default: {
    bold: (s: string) => s,
    dim: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    cyan: (s: string) => s,
  },
}))

// Mock report.ts to avoid complex HTML generation in unit tests
vi.mock('../report.js', () => ({
  generateDetailedReport: vi.fn(() => '<html><body>Mock Report</body></html>'),
}))

const mockResult = {
  run_id: 'test-run-2026-04-03',
  name: 'Test Eval Run',
  timestamp: '2026-04-03T06:00:00Z',
  models: ['model-a', 'model-b'],
  cases: [
    {
      case_id: 'case-1',
      prompt: 'What is 2+2?',
      criteria: 'Correct arithmetic',
      responses: {
        'model-a': { text: '4', latency_ms: 100, tokens_used: 10, cost_usd: 0 },
      },
      scores: {
        'model-a': { total: 9.5, accuracy: 10, completeness: 9, conciseness: 9, reasoning: 'Correct', confidence: 0.95 },
      },
    },
  ],
  summary: {
    'model-a': {
      model_id: 'model-a',
      avg_total: 9.5,
      avg_accuracy: 10,
      avg_completeness: 9,
      avg_conciseness: 9,
      avg_latency_ms: 100,
      total_cost_usd: 0,
      win_rate: 100,
    },
  },
}

describe('share command', () => {
  let tmpDir: string
  let originalCwd: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-share-test-'))
    originalCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('generates HTML from latest result in results/ dir', async () => {
    // Create a results dir with a mock result
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    fs.writeFileSync(
      path.join(resultsDir, `${mockResult.run_id}.json`),
      JSON.stringify(mockResult)
    )

    const { shareCommand } = await import('../share.js')
    await shareCommand({})

    const shareDir = path.join(tmpDir, 'verdict-share')
    expect(fs.existsSync(shareDir)).toBe(true)

    const outputFile = path.join(shareDir, `${mockResult.run_id}.html`)
    expect(fs.existsSync(outputFile)).toBe(true)

    const content = fs.readFileSync(outputFile, 'utf-8')
    expect(content).toContain('Mock Report')
  })

  it('generates HTML from results/private/ dir (preferred over results/)', async () => {
    // Create both dirs but put a different result in private
    const publicDir = path.join(tmpDir, 'results')
    const privateDir = path.join(tmpDir, 'results', 'private')
    fs.mkdirSync(privateDir, { recursive: true })

    fs.writeFileSync(
      path.join(publicDir, 'old-run.json'),
      JSON.stringify({ ...mockResult, run_id: 'old-run' })
    )
    fs.writeFileSync(
      path.join(privateDir, 'new-run-2026-04-03.json'),
      JSON.stringify({ ...mockResult, run_id: 'new-run-2026-04-03' })
    )

    const { shareCommand } = await import('../share.js')
    await shareCommand({})

    const shareDir = path.join(tmpDir, 'verdict-share')
    // Private dir is checked first — newest file there
    const files = fs.readdirSync(shareDir)
    expect(files.some(f => f.includes('new-run'))).toBe(true)
  })

  it('writes to --output path when specified', async () => {
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    fs.writeFileSync(
      path.join(resultsDir, `${mockResult.run_id}.json`),
      JSON.stringify(mockResult)
    )

    const outputPath = path.join(tmpDir, 'my-report.html')
    const { shareCommand } = await import('../share.js')
    await shareCommand({ output: outputPath })

    expect(fs.existsSync(outputPath)).toBe(true)
    const content = fs.readFileSync(outputPath, 'utf-8')
    expect(content).toContain('Mock Report')
  })

  it('finds result by --run id', async () => {
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    // Write two results
    fs.writeFileSync(
      path.join(resultsDir, 'run-alpha.json'),
      JSON.stringify({ ...mockResult, run_id: 'run-alpha' })
    )
    fs.writeFileSync(
      path.join(resultsDir, 'run-beta.json'),
      JSON.stringify({ ...mockResult, run_id: 'run-beta' })
    )

    const { shareCommand } = await import('../share.js')
    const outputPath = path.join(tmpDir, 'specific.html')
    await shareCommand({ run: 'run-alpha', output: outputPath })

    expect(fs.existsSync(outputPath)).toBe(true)
  })

  it('exits with error when no results found', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as any)

    const { shareCommand } = await import('../share.js')

    await expect(shareCommand({})).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })

  it('exits with error when --run id not found', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as any)

    const { shareCommand } = await import('../share.js')

    await expect(shareCommand({ run: 'nonexistent-run-id' })).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })

  it('exits with error when --gist used without GITHUB_TOKEN', async () => {
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    fs.writeFileSync(
      path.join(resultsDir, `${mockResult.run_id}.json`),
      JSON.stringify(mockResult)
    )

    delete process.env.GITHUB_TOKEN

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as any)

    const { shareCommand } = await import('../share.js')

    await expect(shareCommand({ gist: true })).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })

  it('uploads to GitHub Gist when --gist and GITHUB_TOKEN provided', async () => {
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    fs.writeFileSync(
      path.join(resultsDir, `${mockResult.run_id}.json`),
      JSON.stringify(mockResult)
    )

    process.env.GITHUB_TOKEN = 'mock-token'

    // Mock fetch
    const mockRawUrl = `https://gist.githubusercontent.com/raw/verdict-${mockResult.run_id}.html`
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        html_url: 'https://gist.github.com/abc123',
        id: 'abc123',
        files: {
          [`verdict-${mockResult.run_id}.html`]: { raw_url: mockRawUrl },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { shareCommand } = await import('../share.js')
    await shareCommand({ gist: true })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.github.com/gists')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('token mock-token')

    const body = JSON.parse(opts.body)
    expect(body.public).toBe(false)
    expect(Object.keys(body.files)).toHaveLength(1)
    expect(Object.keys(body.files)[0]).toContain('verdict-')

    delete process.env.GITHUB_TOKEN
    vi.unstubAllGlobals()
  })
})
