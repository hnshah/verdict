import { describe, it, expect, vi } from 'vitest'
import {
  toModelConfig,
  toJudgeConfig,
  scoreSingleCase,
  type VitestModelConfig,
  type VitestJudgeConfig,
} from '../vitest.js'
import type { EvalCase } from '../../types/index.js'

// Mock callModel at top level so vitest hoisting works correctly
vi.mock('../../providers/compat.js', () => ({
  callModel: vi.fn().mockResolvedValue({
    text: 'Paris',
    model_id: 'test',
    input_tokens: 10,
    output_tokens: 5,
    latency_ms: 100,
  }),
  clearClientCache: vi.fn(),
}))

// ─── toModelConfig ────────────────────────────────────────────────────────────

describe('toModelConfig', () => {
  const base: VitestModelConfig = {
    id: 'test-model',
    model: 'llama3.1:8b',
    base_url: 'http://localhost:11434/v1',
    api_key: 'none',
  }

  it('maps id and model correctly', () => {
    const cfg = toModelConfig(base)
    expect(cfg.id).toBe('test-model')
    expect(cfg.model).toBe('llama3.1:8b')
  })

  it('maps base_url and api_key', () => {
    const cfg = toModelConfig(base)
    expect(cfg.base_url).toBe('http://localhost:11434/v1')
    expect(cfg.api_key).toBe('none')
  })

  it('defaults api_key to "none" when omitted', () => {
    const cfg = toModelConfig({ id: 'x', model: 'y' })
    expect(cfg.api_key).toBe('none')
  })

  it('defaults timeout_ms to 30000', () => {
    const cfg = toModelConfig(base)
    expect(cfg.timeout_ms).toBe(30_000)
  })

  it('respects custom timeout_ms', () => {
    const cfg = toModelConfig({ ...base, timeout_ms: 60_000 })
    expect(cfg.timeout_ms).toBe(60_000)
  })

  it('defaults max_tokens to 1024', () => {
    const cfg = toModelConfig(base)
    expect(cfg.max_tokens).toBe(1024)
  })

  it('includes empty tags array', () => {
    const cfg = toModelConfig(base)
    expect(cfg.tags).toEqual([])
  })
})

// ─── toJudgeConfig ────────────────────────────────────────────────────────────

describe('toJudgeConfig', () => {
  const base: VitestJudgeConfig = {
    model: 'gpt-4o-mini',
    base_url: 'https://api.openai.com/v1',
    api_key: 'sk-test',
  }

  it('returns judgeConfig and judgeModel', () => {
    const { judgeConfig, judgeModel } = toJudgeConfig(base)
    expect(judgeConfig).toBeDefined()
    expect(judgeModel).toBeDefined()
  })

  it('sets judge model name', () => {
    const { judgeConfig, judgeModel } = toJudgeConfig(base)
    expect(judgeConfig.model).toBe('gpt-4o-mini')
    expect(judgeModel.model).toBe('gpt-4o-mini')
  })

  it('sets judge base_url', () => {
    const { judgeModel } = toJudgeConfig(base)
    expect(judgeModel.base_url).toBe('https://api.openai.com/v1')
  })

  it('defaults base_url to OpenAI when omitted', () => {
    const { judgeModel } = toJudgeConfig({ model: 'gpt-4o-mini' })
    expect(judgeModel.base_url).toBe('https://api.openai.com/v1')
  })

  it('uses default rubric weights', () => {
    const { judgeConfig } = toJudgeConfig(base)
    expect(judgeConfig.rubric.accuracy).toBe(0.4)
    expect(judgeConfig.rubric.completeness).toBe(0.4)
    expect(judgeConfig.rubric.conciseness).toBe(0.2)
  })

  it('respects custom rubric weights', () => {
    const { judgeConfig } = toJudgeConfig({
      ...base,
      rubric: { accuracy: 0.5, completeness: 0.3, conciseness: 0.2 },
    })
    expect(judgeConfig.rubric.accuracy).toBe(0.5)
    expect(judgeConfig.rubric.completeness).toBe(0.3)
  })

  it('sets judgeModel id to "vitest-judge"', () => {
    const { judgeModel } = toJudgeConfig(base)
    expect(judgeModel.id).toBe('vitest-judge')
  })
})

// ─── scoreSingleCase — deterministic scorers ──────────────────────────────────

describe('scoreSingleCase — deterministic', () => {
  const modelConfig = toModelConfig({
    id: 'test',
    model: 'dummy',
    base_url: 'http://localhost:1/v1',
    api_key: 'none',
  })

  it('scores exact match (correct) → 10', async () => {
    // callModel is mocked at module level to return 'Paris'
    const evalCase: EvalCase = {
      id: 'test-exact',
      prompt: 'What is the capital of France?',
      criteria: 'Must say Paris',
      scorer: 'exact',
      expected: 'Paris',
      tags: [],
      judge_type: 'llm',
      judge_style: 'standard',
    }

    const score = await scoreSingleCase(evalCase, modelConfig)
    expect(score).toBe(10)
  })

  it('scores exact match (wrong answer) → 0', async () => {
    const { callModel } = await import('../../providers/compat.js')
    vi.mocked(callModel).mockResolvedValue({
      text: 'London',
      model_id: 'test',
      input_tokens: 10,
      output_tokens: 5,
      latency_ms: 100,
    })

    const evalCase: EvalCase = {
      id: 'test-exact-wrong',
      prompt: 'What is the capital of France?',
      criteria: 'Must say Paris',
      scorer: 'exact',
      expected: 'Paris',
      tags: [],
      judge_type: 'llm',
      judge_style: 'standard',
    }

    const score = await scoreSingleCase(evalCase, modelConfig)
    expect(score).toBe(0)
  })

  it('scores contains match (present) → 10', async () => {
    const { callModel } = await import('../../providers/compat.js')
    vi.mocked(callModel).mockResolvedValue({
      text: 'The capital of France is Paris, a beautiful city.',
      model_id: 'test',
      input_tokens: 10,
      output_tokens: 20,
      latency_ms: 150,
    })

    const evalCase: EvalCase = {
      id: 'test-contains',
      prompt: 'Tell me about the capital of France',
      criteria: 'Must mention Paris',
      scorer: 'contains',
      expected: 'Paris',
      tags: [],
      judge_type: 'llm',
      judge_style: 'standard',
    }

    const score = await scoreSingleCase(evalCase, modelConfig)
    expect(score).toBe(10)
  })

  it('throws when LLM scorer used without judge config', async () => {
    const { callModel } = await import('../../providers/compat.js')
    vi.mocked(callModel).mockResolvedValue({
      text: 'Some answer',
      model_id: 'test',
      input_tokens: 10,
      output_tokens: 10,
      latency_ms: 100,
    })

    const evalCase: EvalCase = {
      id: 'test-llm-no-judge',
      prompt: 'Explain quantum entanglement',
      criteria: 'Clear and accurate explanation',
      scorer: 'llm',
      tags: [],
      judge_type: 'llm',
      judge_style: 'standard',
    }

    await expect(scoreSingleCase(evalCase, modelConfig)).rejects.toThrow(
      /requires LLM judge.*no judge config/
    )
  })
})

// ─── describeEvals shape ──────────────────────────────────────────────────────

describe('describeEvals — export shape', () => {
  it('exports describeEvals as a function', async () => {
    const mod = await import('../vitest.js')
    expect(typeof mod.describeEvals).toBe('function')
  })

  it('exports toModelConfig', async () => {
    const mod = await import('../vitest.js')
    expect(typeof mod.toModelConfig).toBe('function')
  })

  it('exports toJudgeConfig', async () => {
    const mod = await import('../vitest.js')
    expect(typeof mod.toJudgeConfig).toBe('function')
  })

  it('exports scoreSingleCase', async () => {
    const mod = await import('../vitest.js')
    expect(typeof mod.scoreSingleCase).toBe('function')
  })
})
