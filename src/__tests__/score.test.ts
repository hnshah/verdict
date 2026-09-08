import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the judge module to avoid real API calls
vi.mock('../judge/llm.js', () => ({
  judgeResponse: vi.fn(),
  clearJudgeClientCache: vi.fn(),
}))

// Mock OpenAI to avoid real API calls — factory function avoids hoisting issues
vi.mock('openai', () => {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: 'This is a generated response.' } }],
  })
  class OpenAI {
    chat = { completions: { create } }
    constructor(_opts: unknown) {}
  }
  return { default: OpenAI }
})

import { verdictScore } from '../score.js'
import { judgeResponse } from '../judge/llm.js'

const mockJudgeResponse = vi.mocked(judgeResponse)

const mockModelOptions = {
  base_url: 'http://localhost:11434/v1',
  api_key: 'none',
  model: 'llama3.1:8b',
}

const mockJudgeOptions = {
  base_url: 'http://localhost:11434/v1',
  api_key: 'none',
  model: 'llama3.1:8b',
}

const mockScore = {
  accuracy: 8,
  completeness: 7,
  conciseness: 9,
  total: 7.8,
  reasoning: 'Good response, covers the main points.',
  confidence: 7,
}

describe('verdictScore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJudgeResponse.mockResolvedValue(mockScore)
  })

  it('returns a JudgeScore when response is provided', async () => {
    const result = await verdictScore({
      model: mockModelOptions,
      judge: mockJudgeOptions,
      prompt: 'What is the capital of France?',
      response: 'The capital of France is Paris.',
      criteria: 'Correct and concise answer.',
    })

    expect(result.total).toBe(7.8)
    expect(result.accuracy).toBe(8)
    expect(result.completeness).toBe(7)
    expect(result.conciseness).toBe(9)
    expect(result.reasoning).toBe('Good response, covers the main points.')
  })

  it('includes response and generated=false when response is provided', async () => {
    const result = await verdictScore({
      model: mockModelOptions,
      judge: mockJudgeOptions,
      prompt: 'What is the capital of France?',
      response: 'Paris.',
      criteria: 'Correct and concise answer.',
    })

    expect(result.response).toBe('Paris.')
    expect(result.generated).toBe(false)
  })

  it('generates a response when none is provided, sets generated=true', async () => {
    const result = await verdictScore({
      model: mockModelOptions,
      judge: mockJudgeOptions,
      prompt: 'What is the capital of France?',
      criteria: 'Correct and concise answer.',
    })

    expect(result.generated).toBe(true)
    expect(result.response).toBe('This is a generated response.')
  })

  it('includes confidence when judge returns it', async () => {
    const result = await verdictScore({
      model: mockModelOptions,
      judge: mockJudgeOptions,
      prompt: 'What is 2+2?',
      response: '4',
      criteria: 'Mathematically correct.',
    })

    expect(result.confidence).toBe(7)
  })

  it('works without confidence field (backward compatible)', async () => {
    mockJudgeResponse.mockResolvedValue({
      accuracy: 9,
      completeness: 9,
      conciseness: 9,
      total: 9,
      reasoning: 'Perfect.',
    })

    const result = await verdictScore({
      model: mockModelOptions,
      judge: mockJudgeOptions,
      prompt: 'What is 2+2?',
      response: '4',
      criteria: 'Correct.',
    })

    expect(result.confidence).toBeUndefined()
    expect(result.total).toBe(9)
  })

  it('uses default judge settings when judge config is omitted', async () => {
    // Should not throw even without explicit judge config
    const result = await verdictScore({
      model: mockModelOptions,
      prompt: 'What is 2+2?',
      response: '4',
      criteria: 'Correct.',
    })

    expect(result.total).toBe(7.8)
    // judgeResponse called with inline-judge model
    expect(mockJudgeResponse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'inline-judge' }),
      expect.any(Object),
      'What is 2+2?',
      'Correct.',
      '4'
    )
  })

  it('passes prompt and criteria to judgeResponse', async () => {
    await verdictScore({
      model: mockModelOptions,
      judge: mockJudgeOptions,
      prompt: 'Explain recursion.',
      response: 'Recursion is when a function calls itself.',
      criteria: 'Technically accurate definition.',
    })

    expect(mockJudgeResponse).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'Explain recursion.',
      'Technically accurate definition.',
      'Recursion is when a function calls itself.'
    )
  })

  it('applies custom rubric weights when provided', async () => {
    await verdictScore({
      model: mockModelOptions,
      judge: {
        ...mockJudgeOptions,
        rubric: { accuracy: 0.7, completeness: 0.2, conciseness: 0.1 },
      },
      prompt: 'What is 2+2?',
      response: '4',
      criteria: 'Correct.',
    })

    expect(mockJudgeResponse).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        rubric: { accuracy: 0.7, completeness: 0.2, conciseness: 0.1 },
      }),
      expect.any(String),
      expect.any(String),
      expect.any(String)
    )
  })

  it('exports VerdictScoreResult type correctly (structural)', async () => {
    const result = await verdictScore({
      model: mockModelOptions,
      judge: mockJudgeOptions,
      prompt: 'Test',
      response: 'Test response',
      criteria: 'Test criteria',
    })

    // Shape check
    expect(typeof result.total).toBe('number')
    expect(typeof result.accuracy).toBe('number')
    expect(typeof result.completeness).toBe('number')
    expect(typeof result.conciseness).toBe('number')
    expect(typeof result.reasoning).toBe('string')
    expect(typeof result.response).toBe('string')
    expect(typeof result.generated).toBe('boolean')
  })
})
