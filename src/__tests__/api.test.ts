/**
 * Programmatic API surface tests
 *
 * Verifies that the public index.ts exports are all present and callable
 * without requiring live model endpoints.
 */

import { describe, it, expect } from 'vitest'
import {
  // runner
  computeConfigHash,
  getCheckpointPath,
  loadCheckpoint,
  // config
  loadConfig,
  loadEvalPack,
  // judges
  judgeResponse,
  clearJudgeClientCache,
  scoreJson,
  scoreExact,
  scoreContains,
  scoreFuzzyMatch,
  scoreRegex,
  scoreToolCall,
  scoreJsonSchema,
  scoreMultipleChoice,
  isDeterministic,
  scoreDeterministic,
  // reporter
  generateMarkdownReport,
  // db
  getDb,
  initSchema,
  saveRunResult,
  queryHistory,
  parseSince,
} from '../index.js'
import type {
  Config,
  ModelConfig,
  JudgeConfig,
  EvalCase,
  EvalPack,
  RunResult,
  ModelSummary,
  CaseResult,
} from '../index.js'
import path from 'path'
import fs from 'fs'
import os from 'os'

// ─── Minimal config fixture ───────────────────────────────────────────────────

const minimalConfig: Config = {
  name: 'Test',
  models: [
    {
      id: 'test-model',
      model: 'gpt-4o-mini',
      api_key: 'test',
      tags: [],
      port: 8080,
      timeout_ms: 30000,
      max_tokens: 512,
    },
  ],
  judge: {
    model: 'gpt-4o-mini',
    blind: true,
    strategy: 'single',
    rubric: { accuracy: 0.4, completeness: 0.4, conciseness: 0.2 },
  },
  packs: [],
  run: { concurrency: 3, retries: 2, cache: true },
  output: { dir: './results', formats: ['json', 'markdown'], delta: true },
}

// ─── Exports exist ────────────────────────────────────────────────────────────

describe('API exports', () => {
  it('exports runner functions', () => {
    expect(typeof computeConfigHash).toBe('function')
    expect(typeof getCheckpointPath).toBe('function')
    expect(typeof loadCheckpoint).toBe('function')
  })

  it('exports config/pack loaders', () => {
    expect(typeof loadConfig).toBe('function')
    expect(typeof loadEvalPack).toBe('function')
  })

  it('exports judge functions', () => {
    expect(typeof judgeResponse).toBe('function')
    expect(typeof clearJudgeClientCache).toBe('function')
    expect(typeof scoreJson).toBe('function')
    expect(typeof scoreExact).toBe('function')
    expect(typeof scoreContains).toBe('function')
    expect(typeof scoreFuzzyMatch).toBe('function')
    expect(typeof scoreRegex).toBe('function')
    expect(typeof scoreToolCall).toBe('function')
    expect(typeof scoreJsonSchema).toBe('function')
    expect(typeof scoreMultipleChoice).toBe('function')
    expect(typeof isDeterministic).toBe('function')
    expect(typeof scoreDeterministic).toBe('function')
  })

  it('exports reporter', () => {
    expect(typeof generateMarkdownReport).toBe('function')
  })

  it('exports db utilities', () => {
    expect(typeof getDb).toBe('function')
    expect(typeof initSchema).toBe('function')
    expect(typeof saveRunResult).toBe('function')
    expect(typeof queryHistory).toBe('function')
    expect(typeof parseSince).toBe('function')
  })
})

// ─── computeConfigHash ────────────────────────────────────────────────────────

describe('computeConfigHash', () => {
  it('returns a 12-char hex string', () => {
    const hash = computeConfigHash(minimalConfig)
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
  })

  it('is deterministic for the same config', () => {
    expect(computeConfigHash(minimalConfig)).toBe(computeConfigHash(minimalConfig))
  })

  it('differs when model list changes', () => {
    const config2 = {
      ...minimalConfig,
      models: [{ ...minimalConfig.models[0], id: 'other-model' }],
    }
    expect(computeConfigHash(minimalConfig)).not.toBe(computeConfigHash(config2))
  })
})

// ─── getCheckpointPath ───────────────────────────────────────────────────────

describe('getCheckpointPath', () => {
  it('returns a path ending in .verdict-checkpoint.json', () => {
    expect(getCheckpointPath('/tmp/results')).toBe(
      '/tmp/results/.verdict-checkpoint.json'
    )
  })
})

// ─── loadCheckpoint ──────────────────────────────────────────────────────────

describe('loadCheckpoint', () => {
  it('returns null when directory does not exist', () => {
    expect(loadCheckpoint('/tmp/__verdict_nonexistent__', 'abc123')).toBeNull()
  })

  it('returns null when hash mismatch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-test-'))
    const cp = {
      runId: 'run-1',
      configHash: 'aaa',
      completedCaseIds: [],
      partialResults: [],
      startedAt: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(dir, '.verdict-checkpoint.json'), JSON.stringify(cp))
    expect(loadCheckpoint(dir, 'bbb')).toBeNull()
    fs.rmSync(dir, { recursive: true })
  })

  it('returns checkpoint when hash matches', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-test-'))
    const cp = {
      runId: 'run-1',
      configHash: 'abc123',
      completedCaseIds: ['case-1'],
      partialResults: [],
      startedAt: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(dir, '.verdict-checkpoint.json'), JSON.stringify(cp))
    const loaded = loadCheckpoint(dir, 'abc123')
    expect(loaded).not.toBeNull()
    expect(loaded?.completedCaseIds).toEqual(['case-1'])
    fs.rmSync(dir, { recursive: true })
  })
})

// ─── Deterministic scorers ───────────────────────────────────────────────────

// JudgeScore uses total: 10 = pass, total: 0 = fail

describe('scoreJson', () => {
  it('passes on valid JSON output', () => {
    expect(scoreJson('{"key":"value"}').total).toBeGreaterThan(0)
  })
  it('fails on invalid JSON', () => {
    expect(scoreJson('not json').total).toBe(0)
  })
})

describe('scoreExact', () => {
  it('passes on exact match', () => {
    expect(scoreExact('hello', 'hello').total).toBe(10)
  })
  it('fails on mismatch', () => {
    expect(scoreExact('hello', 'world').total).toBe(0)
  })
  it('passes when output matches any expected string in array', () => {
    expect(scoreExact('B', ['A', 'B', 'C']).total).toBe(10)
  })
})

describe('scoreContains', () => {
  it('passes when output contains expected substring', () => {
    expect(scoreContains('The answer is 42', '42').total).toBe(10)
  })
  it('fails when substring absent', () => {
    expect(scoreContains('The answer is 42', '100').total).toBe(0)
  })
})

describe('scoreRegex', () => {
  it('passes when output matches regex', () => {
    expect(scoreRegex('abc123', '[a-z]+\\d+').total).toBe(10)
  })
  it('fails when no match', () => {
    expect(scoreRegex('hello', '^\\d+$').total).toBe(0)
  })
})

describe('scoreMultipleChoice', () => {
  it('passes on correct letter answer', () => {
    expect(scoreMultipleChoice('B', 'B').total).toBe(10)
  })
  it('passes on answer embedded in sentence (partial credit)', () => {
    // Expected letter found with extra text → partial credit (total: 8)
    expect(scoreMultipleChoice('The answer is C.', 'C').total).toBeGreaterThan(0)
  })
  it('fails on wrong answer', () => {
    expect(scoreMultipleChoice('A', 'C').total).toBe(0)
  })
})

describe('isDeterministic', () => {
  it('returns true for deterministic scorers', () => {
    expect(isDeterministic('json')).toBe(true)
    expect(isDeterministic('exact')).toBe(true)
    expect(isDeterministic('contains')).toBe(true)
    expect(isDeterministic('regex')).toBe(true)
    expect(isDeterministic('jsonschema')).toBe(true)
    expect(isDeterministic('tool_call')).toBe(true)
    expect(isDeterministic('fuzzy_match')).toBe(true)
  })
  it('returns false for llm scorer', () => {
    expect(isDeterministic('llm')).toBe(false)
  })
  it('returns false for multiple_choice (uses LLM for partial credit)', () => {
    expect(isDeterministic('multiple_choice')).toBe(false)
  })
})

// ─── generateMarkdownReport ───────────────────────────────────────────────────

describe('generateMarkdownReport', () => {
  it('produces a markdown string with leaderboard header', () => {
    const mockSummary: ModelSummary = {
      model_id: 'test-model',
      avg_total: 8.5,
      avg_accuracy: 0.9,
      avg_completeness: 0.85,
      avg_conciseness: 0.8,
      avg_latency_ms: 1200,
      avg_tokens_per_sec: 50,
      total_cost_usd: 0.001,
      win_rate: 0.8,
      wins: 4,
      cases_run: 5,
      avg_solve_rate: 0.9,
    }
    const mockResult: RunResult = {
      run_id: 'test-run-001',
      name: 'Test Run',
      timestamp: new Date().toISOString(),
      models: ['test-model'],
      cases: [],
      summary: { 'test-model': mockSummary },
    }
    const md = generateMarkdownReport(mockResult)
    expect(typeof md).toBe('string')
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('test-model')
    expect(md).toContain('Leaderboard')
  })
})

// ─── DB: in-memory operations ─────────────────────────────────────────────────

describe('getDb + initSchema', () => {
  it('creates an in-memory DB without throwing', () => {
    const db = getDb(':memory:')
    expect(() => initSchema(db)).not.toThrow()
    db.close()
  })
})

describe('queryHistory', () => {
  it('returns empty array on fresh DB', () => {
    const db = getDb(':memory:')
    initSchema(db)
    expect(queryHistory(db, { limit: 10 })).toEqual([])
    db.close()
  })
})

describe('parseSince', () => {
  it('parses "7d" as a Date 7 days ago', () => {
    const result = parseSince('7d')
    expect(result).toBeInstanceOf(Date)
    const diffDays = (Date.now() - result!.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(7, 0)
  })

  it('returns null for invalid input', () => {
    expect(parseSince('invalid')).toBeNull()
  })
})
