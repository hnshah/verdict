import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  listBaselines,
  loadBaselineMeta,
  saveBaseline,
} from '../baseline.js'
import type { RunResult } from '../../types/index.js'

let tmp: string
let resultPath: string

const sampleResult: RunResult = {
  run_id: 'r1',
  name: 'sample',
  timestamp: '2026-05-21T12:00:00Z',
  models: ['m'],
  cases: [],
  summary: {
    m: {
      model_id: 'm',
      avg_total: 7.5,
      avg_accuracy: 8,
      avg_completeness: 7,
      avg_conciseness: 7,
      avg_latency_ms: 100,
      avg_tokens_per_sec: 0,
      total_cost_usd: 0,
      win_rate: 1,
      wins: 1,
      cases_run: 1,
      avg_solve_rate: 1,
    },
  },
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-baseline-'))
  resultPath = path.join(tmp, 'result.json')
  fs.writeFileSync(resultPath, JSON.stringify(sampleResult))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('baseline metadata', () => {
  it('saveBaseline with description writes a sidecar', () => {
    saveBaseline('production-v1.2', resultPath, {
      cwd: tmp,
      description: 'before claude-haiku-3-5 upgrade',
    })
    const meta = loadBaselineMeta('production-v1.2', tmp)
    expect(meta?.description).toBe('before claude-haiku-3-5 upgrade')
    expect(meta?.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('saveBaseline without description still writes a sidecar (with savedAt)', () => {
    saveBaseline('untitled', resultPath, { cwd: tmp })
    const meta = loadBaselineMeta('untitled', tmp)
    expect(meta).not.toBeNull()
    expect(meta?.description).toBeUndefined()
    expect(meta?.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('legacy cwd-string signature still works', () => {
    saveBaseline('legacy', resultPath, tmp)
    expect(fs.existsSync(path.join(tmp, '.verdict-baselines', 'legacy.json'))).toBe(true)
    // The new code still writes the sidecar (no description); old call
    // sites get the upgrade for free.
    expect(fs.existsSync(path.join(tmp, '.verdict-baselines', 'legacy.meta.json'))).toBe(true)
  })

  it('listBaselines surfaces descriptions and ignores .meta.json sidecars', () => {
    saveBaseline('a', resultPath, { cwd: tmp, description: 'first' })
    saveBaseline('b', resultPath, { cwd: tmp })
    const list = listBaselines(tmp)
    expect(list).toHaveLength(2)
    expect(list.find(b => b.name === 'a')?.description).toBe('first')
    expect(list.find(b => b.name === 'b')?.description).toBeUndefined()
    // Names must not include the sidecar files.
    expect(list.some(b => b.name.endsWith('.meta'))).toBe(false)
  })

  it('listBaselines handles a baseline saved by the legacy code path (no sidecar)', () => {
    // Simulate a baseline saved before this PR — only the result file
    // exists; no .meta.json.
    fs.mkdirSync(path.join(tmp, '.verdict-baselines'), { recursive: true })
    fs.copyFileSync(resultPath, path.join(tmp, '.verdict-baselines', 'pre-existing.json'))
    const list = listBaselines(tmp)
    expect(list.find(b => b.name === 'pre-existing')).toBeDefined()
    expect(list.find(b => b.name === 'pre-existing')?.description).toBeUndefined()
  })
})
