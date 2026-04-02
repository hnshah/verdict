import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// We test the logic of promote by testing the helper functions indirectly
// and testing that the command handles edge cases correctly.

// Since promoteCommand calls process.exit we mock it
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never)
const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})
const mockErr = vi.spyOn(console, 'error').mockImplementation(() => {})

function makeRunResult(runId: string): object {
  return {
    run_id: runId,
    name: 'Test',
    timestamp: '2026-04-02T06:00:00.000Z',
    models: ['model-a'],
    cases: [{ case_id: 'c1', prompt: 'test', criteria: 'good', responses: {}, scores: {} }],
    summary: {
      'model-a': {
        model_id: 'model-a',
        avg_total: 8.5,
        avg_accuracy: 8.5,
        avg_completeness: 8.5,
        avg_conciseness: 8.5,
        avg_latency_ms: 1000,
        avg_tokens_per_sec: 100,
        total_cost_usd: 0,
        win_rate: 100,
        wins: 1,
        cases_run: 1,
        avg_solve_rate: 1,
      },
    },
  }
}

describe('promote command logic', () => {
  let tmpDir: string
  let resultsDir: string
  let originalCwd: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-promote-test-'))
    resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir, { recursive: true })
    originalCwd = process.cwd()
    process.chdir(tmpDir)
    mockExit.mockClear()
    mockLog.mockClear()
    mockErr.mockClear()
  })

  afterEach(() => {
    process.chdir(originalCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('exits 1 when no result files found', async () => {
    // Import inside test to get fresh module with mocked cwd
    const { promoteCommand } = await import('../promote.js')
    await promoteCommand({ force: true })
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('copies latest result to baseline.json with --force', async () => {
    // Write a fake result file
    const runId = '2026-04-02-run_abc123'
    const resultPath = path.join(resultsDir, `${runId}.json`)
    fs.writeFileSync(resultPath, JSON.stringify(makeRunResult(runId)))

    const baselinePath = path.join(resultsDir, 'baseline.json')

    const { promoteCommand } = await import('../promote.js')
    await promoteCommand({ force: true, output: baselinePath })

    expect(fs.existsSync(baselinePath)).toBe(true)
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    expect(baseline.run_id).toBe(runId)
    expect(mockExit).not.toHaveBeenCalledWith(1)
  })

  it('copies specific run by --run flag', async () => {
    const runId = '2026-04-02-run_specific'
    const resultPath = path.join(resultsDir, `${runId}.json`)
    fs.writeFileSync(resultPath, JSON.stringify(makeRunResult(runId)))

    // Also create a newer file
    const newerRunId = '2026-04-02-run_newer'
    fs.writeFileSync(path.join(resultsDir, `${newerRunId}.json`), JSON.stringify(makeRunResult(newerRunId)))

    const baselinePath = path.join(resultsDir, 'baseline.json')
    const { promoteCommand } = await import('../promote.js')
    await promoteCommand({ run: runId, force: true, output: baselinePath })

    expect(fs.existsSync(baselinePath)).toBe(true)
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    expect(baseline.run_id).toBe(runId)
  })

  it('exits 1 when --run references non-existent run', async () => {
    const runId = '2026-04-02-run_abc123'
    fs.writeFileSync(path.join(resultsDir, `${runId}.json`), JSON.stringify(makeRunResult(runId)))

    const { promoteCommand } = await import('../promote.js')
    await promoteCommand({ run: 'nonexistent-run', force: true })
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('copies nth most recent with --nth flag', async () => {
    const runIds = ['2026-04-02-run_c', '2026-04-02-run_b', '2026-04-02-run_a']
    for (const id of runIds) {
      fs.writeFileSync(path.join(resultsDir, `${id}.json`), JSON.stringify(makeRunResult(id)))
    }

    const baselinePath = path.join(resultsDir, 'baseline.json')
    const { promoteCommand } = await import('../promote.js')
    // nth=2 should get the 2nd most recent (run_b when sorted desc: c, b, a)
    await promoteCommand({ nth: 2, force: true, output: baselinePath })

    expect(fs.existsSync(baselinePath)).toBe(true)
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    // 2nd file in descending sort: run_c, run_b, run_a → nth=2 → run_b
    expect(baseline.run_id).toBe('2026-04-02-run_b')
  })

  it('exits 1 when --nth is out of range', async () => {
    const runId = '2026-04-02-run_only'
    fs.writeFileSync(path.join(resultsDir, `${runId}.json`), JSON.stringify(makeRunResult(runId)))

    const { promoteCommand } = await import('../promote.js')
    await promoteCommand({ nth: 5, force: true })
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
