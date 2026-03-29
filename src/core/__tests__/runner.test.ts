import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Config, EvalPack, ModelResponse, JudgeScore } from '../../types/index.js'

// Mock providers and judge before importing runner
vi.mock('../../providers/compat.js', () => ({
  callModel: vi.fn(),
  callModelMultiTurn: vi.fn(),
  callModelWithTools: vi.fn(),
}))

vi.mock('../../judge/llm.js', () => ({
  judgeResponse: vi.fn(),
}))

// Mock fs to avoid writing checkpoint files during tests
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      readFileSync: vi.fn(),
      unlinkSync: vi.fn(),
    },
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  }
})

import { runEvals, computeConfigHash } from '../runner.js'
import { callModel, callModelMultiTurn, callModelWithTools } from '../../providers/compat.js'
import { judgeResponse } from '../../judge/llm.js'

// --- Helpers ---

function makeModelResponse(modelId: string, text = 'mock response'): ModelResponse {
  return {
    model_id: modelId,
    text,
    input_tokens: 10,
    output_tokens: 20,
    latency_ms: 100,
  }
}

function makeJudgeScore(total = 8): JudgeScore {
  return {
    accuracy: total,
    completeness: total,
    conciseness: total,
    total,
    reasoning: 'Good response.',
  }
}

function makeConfig(overrides?: Partial<Config>): Config {
  return {
    name: 'Test Evals',
    models: [
      { id: 'model-a', model: 'model-a', api_key: 'none', base_url: 'http://localhost:11434/v1', tags: [], port: 8080, timeout_ms: 120000, max_tokens: 1024 },
      { id: 'model-b', model: 'model-b', api_key: 'none', base_url: 'http://localhost:11434/v1', tags: [], port: 8080, timeout_ms: 120000, max_tokens: 1024 },
    ],
    judge: {
      model: 'model-a',
      blind: true,
      strategy: 'single',
      rubric: { accuracy: 0.4, completeness: 0.4, conciseness: 0.2 },
    },
    packs: ['./eval-packs/general.yaml'],
    run: { concurrency: 3, retries: 2, cache: true },
    output: { dir: './test-results', formats: ['json'], delta: true },
    ...overrides,
  }
}

function makePack(cases: EvalPack['cases']): EvalPack {
  return {
    name: 'Test Pack',
    version: '1.0.0',
    cases,
  }
}

// --- Tests ---

beforeEach(() => {
  vi.clearAllMocks()
})

describe('computeConfigHash', () => {
  it('returns a 12-character hex string', () => {
    const hash = computeConfigHash(makeConfig())
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
  })

  it('returns stable hashes for the same config', () => {
    const config = makeConfig()
    expect(computeConfigHash(config)).toBe(computeConfigHash(config))
  })

  it('returns different hashes for different models', () => {
    const config1 = makeConfig()
    const config2 = makeConfig({
      models: [
        { id: 'model-c', model: 'model-c', api_key: 'none', base_url: 'http://localhost:11434/v1', tags: [], port: 8080, timeout_ms: 120000, max_tokens: 1024 },
      ],
    })
    expect(computeConfigHash(config1)).not.toBe(computeConfigHash(config2))
  })
})

describe('runEvals', () => {
  it('runs the right number of models × cases', async () => {
    const config = makeConfig()
    const pack = makePack([
      { id: 'case-1', prompt: 'Hello', criteria: 'Be polite', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
      { id: 'case-2', prompt: 'World', criteria: 'Be concise', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
    ])

    vi.mocked(callModel)
      .mockResolvedValueOnce(makeModelResponse('model-a'))
      .mockResolvedValueOnce(makeModelResponse('model-b'))
      .mockResolvedValueOnce(makeModelResponse('model-a'))
      .mockResolvedValueOnce(makeModelResponse('model-b'))

    vi.mocked(judgeResponse).mockResolvedValue(makeJudgeScore(8))

    const result = await runEvals(config, [pack])

    // 2 models × 2 cases = 4 callModel calls
    expect(callModel).toHaveBeenCalledTimes(4)
    // 2 models × 2 cases = 4 judge calls (LLM scorer)
    expect(judgeResponse).toHaveBeenCalledTimes(4)
    expect(result.cases).toHaveLength(2)
  })

  it('uses scoreDeterministic when scorer != llm', async () => {
    const config = makeConfig()
    const pack = makePack([
      { id: 'exact-case', prompt: 'What is 2+2?', criteria: 'Exact match', scorer: 'exact', expected: '4', tags: [], judge_type: 'llm', max_tokens: undefined },
    ])

    vi.mocked(callModel)
      .mockResolvedValueOnce(makeModelResponse('model-a', '4'))
      .mockResolvedValueOnce(makeModelResponse('model-b', '5'))

    const result = await runEvals(config, [pack])

    // Should NOT call judgeResponse for deterministic scorer
    expect(judgeResponse).not.toHaveBeenCalled()
    // model-a answered '4' -> score 10, model-b answered '5' -> score 0
    expect(result.cases[0].scores['model-a'].total).toBe(10)
    expect(result.cases[0].scores['model-b'].total).toBe(0)
  })

  it('returns RunResult with expected shape', async () => {
    const config = makeConfig()
    const pack = makePack([
      { id: 'shape-case', prompt: 'Test', criteria: 'Test criteria', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
    ])

    vi.mocked(callModel).mockResolvedValue(makeModelResponse('model-a'))
    vi.mocked(judgeResponse).mockResolvedValue(makeJudgeScore(7))

    const result = await runEvals(config, [pack])

    // Top-level RunResult shape
    expect(result).toHaveProperty('run_id')
    expect(result).toHaveProperty('name', 'Test Evals')
    expect(result).toHaveProperty('timestamp')
    expect(result).toHaveProperty('models')
    expect(result).toHaveProperty('cases')
    expect(result).toHaveProperty('summary')
    expect(result.models).toEqual(['model-a', 'model-b'])

    // CaseResult shape
    const caseResult = result.cases[0]
    expect(caseResult).toHaveProperty('case_id', 'shape-case')
    expect(caseResult).toHaveProperty('prompt', 'Test')
    expect(caseResult).toHaveProperty('criteria', 'Test criteria')
    expect(caseResult).toHaveProperty('responses')
    expect(caseResult).toHaveProperty('scores')

    // ModelSummary shape
    const summaryA = result.summary['model-a']
    expect(summaryA).toHaveProperty('model_id', 'model-a')
    expect(summaryA).toHaveProperty('avg_total')
    expect(summaryA).toHaveProperty('avg_accuracy')
    expect(summaryA).toHaveProperty('avg_completeness')
    expect(summaryA).toHaveProperty('avg_conciseness')
    expect(summaryA).toHaveProperty('avg_latency_ms')
    expect(summaryA).toHaveProperty('total_cost_usd')
    expect(summaryA).toHaveProperty('win_rate')
    expect(summaryA).toHaveProperty('wins')
    expect(summaryA).toHaveProperty('cases_run')
  })

  it('filters cases by categoryFilter', async () => {
    const config = makeConfig()
    const pack = makePack([
      { id: 'code-case', prompt: 'Write code', criteria: 'Works', category: 'coding', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
      { id: 'math-case', prompt: 'Solve 2+2', criteria: 'Correct', category: 'math', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
      { id: 'writing-case', prompt: 'Write essay', criteria: 'Good', category: 'writing', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
    ])

    vi.mocked(callModel).mockResolvedValue(makeModelResponse('model-a'))
    vi.mocked(judgeResponse).mockResolvedValue(makeJudgeScore(8))

    const result = await runEvals(config, [pack], undefined, false, ['math'])

    // Only the math case should run
    expect(result.cases).toHaveLength(1)
    expect(result.cases[0].case_id).toBe('math-case')
    // 1 case × 2 models = 2 callModel calls
    expect(callModel).toHaveBeenCalledTimes(2)
  })

  it('filters multiple categories', async () => {
    const config = makeConfig()
    const pack = makePack([
      { id: 'code-case', prompt: 'Write code', criteria: 'Works', category: 'coding', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
      { id: 'math-case', prompt: 'Solve 2+2', criteria: 'Correct', category: 'math', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
      { id: 'writing-case', prompt: 'Write essay', criteria: 'Good', category: 'writing', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
    ])

    vi.mocked(callModel).mockResolvedValue(makeModelResponse('model-a'))
    vi.mocked(judgeResponse).mockResolvedValue(makeJudgeScore(8))

    const result = await runEvals(config, [pack], undefined, false, ['math', 'writing'])

    expect(result.cases).toHaveLength(2)
    expect(result.cases.map(c => c.case_id)).toEqual(['math-case', 'writing-case'])
  })

  it('throws when judge model is not in models list', async () => {
    const config = makeConfig({
      judge: {
        model: 'nonexistent-model',
        blind: true,
        strategy: 'single',
        rubric: { accuracy: 0.4, completeness: 0.4, conciseness: 0.2 },
      },
    })
    const pack = makePack([
      { id: 'case-1', prompt: 'Hello', criteria: 'Be polite', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
    ])

    await expect(runEvals(config, [pack])).rejects.toThrow("Judge model 'nonexistent-model' not found")
  })

  it('handles model errors gracefully with zero scores', async () => {
    const config = makeConfig()
    const pack = makePack([
      { id: 'error-case', prompt: 'Test', criteria: 'Test', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
    ])

    vi.mocked(callModel)
      .mockResolvedValueOnce({ ...makeModelResponse('model-a'), text: '', error: 'API error' })
      .mockResolvedValueOnce(makeModelResponse('model-b'))

    vi.mocked(judgeResponse).mockResolvedValue(makeJudgeScore(7))

    const result = await runEvals(config, [pack])

    // model-a had an error, so score should be 0
    expect(result.cases[0].scores['model-a'].total).toBe(0)
    expect(result.cases[0].scores['model-a'].reasoning).toContain('API error')
    // model-b should be scored normally
    expect(result.cases[0].scores['model-b'].total).toBe(7)
  })

  it('determines winner from highest scoring model', async () => {
    const config = makeConfig()
    const pack = makePack([
      { id: 'winner-case', prompt: 'Test', criteria: 'Test', scorer: 'exact', expected: 'correct', tags: [], judge_type: 'llm', max_tokens: undefined },
    ])

    vi.mocked(callModel)
      .mockResolvedValueOnce(makeModelResponse('model-a', 'wrong'))
      .mockResolvedValueOnce(makeModelResponse('model-b', 'correct'))

    const result = await runEvals(config, [pack])

    expect(result.cases[0].winner).toBe('model-b')
  })

  it('computes averages in summary correctly', async () => {
    const config = makeConfig()
    const pack = makePack([
      { id: 'avg-1', prompt: 'Test 1', criteria: 'Test', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
      { id: 'avg-2', prompt: 'Test 2', criteria: 'Test', scorer: 'llm', tags: [], judge_type: 'llm', max_tokens: undefined },
    ])

    vi.mocked(callModel).mockResolvedValue(makeModelResponse('model-a'))
    vi.mocked(judgeResponse)
      .mockResolvedValueOnce(makeJudgeScore(6)) // model-a, case-1
      .mockResolvedValueOnce(makeJudgeScore(10)) // model-b, case-1
      .mockResolvedValueOnce(makeJudgeScore(8)) // model-a, case-2
      .mockResolvedValueOnce(makeJudgeScore(10)) // model-b, case-2

    const result = await runEvals(config, [pack])

    expect(result.summary['model-a'].avg_total).toBe(7) // (6+8)/2
    expect(result.summary['model-b'].avg_total).toBe(10) // (10+10)/2
    expect(result.summary['model-a'].cases_run).toBe(2)
    expect(result.summary['model-b'].cases_run).toBe(2)
  })

  it('calls callModelWithTools for tool_call scorer with tools', async () => {
    const config = makeConfig()
    const tools = [{ name: 'get_weather', description: 'Get weather', parameters: {} }]
    const pack = makePack([
      {
        id: 'tool-case', prompt: 'What is the weather?', criteria: 'Uses tool',
        scorer: 'tool_call', tools, expected_tool: 'get_weather',
        tags: [], judge_type: 'llm', max_tokens: undefined,
      },
    ])

    vi.mocked(callModelWithTools).mockResolvedValue({
      ...makeModelResponse('model-a'),
      tool_calls: [{ name: 'get_weather', arguments: {} }],
    })

    const result = await runEvals(config, [pack])

    expect(callModelWithTools).toHaveBeenCalled()
    expect(callModel).not.toHaveBeenCalled()
    expect(result.cases[0].scores['model-a'].total).toBe(6) // correct tool, no expected args
  })

  it('uses callModelMultiTurn for multi-turn cases', async () => {
    const config = makeConfig()
    const pack = makePack([
      {
        id: 'multi-turn-case', prompt: '', criteria: 'Multi-turn works',
        scorer: 'llm',
        turns: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: '__model__' },
          { role: 'user', content: 'How are you?' },
        ],
        tags: [], judge_type: 'llm', max_tokens: undefined,
      },
    ])

    vi.mocked(callModelMultiTurn).mockResolvedValue(makeModelResponse('model-a', 'Fine thanks!'))
    vi.mocked(judgeResponse).mockResolvedValue(makeJudgeScore(9))

    const result = await runEvals(config, [pack])

    expect(callModelMultiTurn).toHaveBeenCalled()
    expect(callModel).not.toHaveBeenCalled()
    expect(result.cases).toHaveLength(1)
  })
})
