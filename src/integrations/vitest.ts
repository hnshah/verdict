/**
 * verdict/vitest — Vitest integration for verdict evals
 *
 * Registers eval cases as native Vitest test blocks so eval failures
 * show up alongside your regular test failures.
 *
 * @example
 * ```ts
 * // model.test.ts
 * import { describeEvals } from 'verdict/vitest'
 *
 * describeEvals('my-model quality', {
 *   pack: './eval-packs/general.yaml',
 *   model: {
 *     id: 'local-llama',
 *     base_url: 'http://localhost:11434/v1',
 *     api_key: 'none',
 *     model: 'llama3.1:8b',
 *   },
 *   threshold: 7.0,
 *   judge: {
 *     model: 'gpt-4o-mini',
 *     base_url: 'https://api.openai.com/v1',
 *     api_key: process.env.OPENAI_API_KEY,
 *   },
 * })
 * ```
 */

import { describe, it, expect, afterAll } from 'vitest'
import type { EvalCase, ModelConfig, JudgeConfig } from '../types/index.js'
import { loadEvalPack } from '../core/config.js'
import { callModel } from '../providers/compat.js'
import { isDeterministic, scoreDeterministic } from '../judge/deterministic.js'
import { judgeResponse } from '../judge/llm.js'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface VitestModelConfig {
  /** Unique identifier for this model */
  id: string
  /** OpenAI-compatible base URL (e.g. http://localhost:11434/v1) */
  base_url?: string
  /** API key — use 'none' for local models */
  api_key?: string
  /** Model name to use */
  model: string
  /** Provider shortcut ('ollama' | 'mlx') — alternative to base_url */
  provider?: 'ollama' | 'mlx'
  /** Max tokens for completions. Default: 1024 */
  max_tokens?: number
  /** Timeout in ms. Default: 30000 */
  timeout_ms?: number
}

export interface VitestJudgeConfig {
  /** Judge model name */
  model: string
  /** OpenAI-compatible base URL for the judge */
  base_url?: string
  /** Judge API key */
  api_key?: string
  /** Scoring rubric weights (must sum to 1.0) */
  rubric?: {
    accuracy?: number
    completeness?: number
    conciseness?: number
  }
}

export interface DescribeEvalsOptions {
  /** Path to eval pack YAML file, or inline eval cases array */
  pack: string | EvalCase[]
  /** Model configuration to test */
  model: VitestModelConfig
  /** Minimum average score (0-10) required to pass the suite. Default: 7.0 */
  threshold?: number
  /** Judge configuration (required for LLM-scored cases) */
  judge?: VitestJudgeConfig
  /** Maximum time for the entire eval run in ms. Default: 300000 (5 min) */
  timeout?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert VitestModelConfig to internal ModelConfig */
export function toModelConfig(m: VitestModelConfig): ModelConfig {
  return {
    id: m.id,
    model: m.model,
    base_url: m.base_url,
    api_key: m.api_key ?? 'none',
    provider: m.provider as ModelConfig['provider'],
    tags: [],
    timeout_ms: m.timeout_ms ?? 30_000,
    max_tokens: m.max_tokens ?? 1024,
    port: 8080,
  }
}

/** Convert VitestJudgeConfig to internal JudgeConfig + judge ModelConfig */
export function toJudgeConfig(j: VitestJudgeConfig): { judgeConfig: JudgeConfig; judgeModel: ModelConfig } {
  const rubric = {
    accuracy: j.rubric?.accuracy ?? 0.4,
    completeness: j.rubric?.completeness ?? 0.4,
    conciseness: j.rubric?.conciseness ?? 0.2,
  }
  const judgeConfig: JudgeConfig = {
    model: j.model,
    blind: true,
    strategy: 'single',
    rubric,
  }
  const judgeModel: ModelConfig = {
    id: 'vitest-judge',
    model: j.model,
    base_url: j.base_url ?? 'https://api.openai.com/v1',
    api_key: j.api_key ?? process.env.OPENAI_API_KEY ?? 'none',
    tags: [],
    timeout_ms: 30_000,
    max_tokens: 256,
    port: 8080,
  }
  return { judgeConfig, judgeModel }
}

/** Score a single eval case and return 0-10 */
export async function scoreSingleCase(
  evalCase: EvalCase,
  modelConfig: ModelConfig,
  judgeModel?: ModelConfig,
  judgeConfig?: JudgeConfig,
): Promise<number> {
  const response = await callModel(modelConfig, evalCase.prompt, 0, undefined, evalCase.system_prompt)

  // Use deterministic scorer when available
  if (isDeterministic(evalCase.scorer)) {
    const result = scoreDeterministic(
      evalCase.scorer,
      response.text ?? '',
      evalCase.expected,
      evalCase.schema,
      evalCase.choices,
      evalCase.scorer_code,
    )
    if (result !== null) return result.total
  }

  // Fall back to LLM judge
  if (!judgeModel || !judgeConfig) {
    throw new Error(
      `Case '${evalCase.id}' requires LLM judge (scorer: '${evalCase.scorer}') but no judge config provided`
    )
  }

  const score = await judgeResponse(judgeModel, judgeConfig, evalCase.prompt, evalCase.criteria, response.text ?? '')
  return score.total
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Register a verdict eval suite as Vitest tests.
 *
 * Runs all eval cases in a single `it()` block and reports per-case results.
 * The suite fails if any case scores below `threshold`, or if the average
 * score across all cases is below `threshold`.
 */
export function describeEvals(name: string, options: DescribeEvalsOptions): void {
  const {
    pack,
    model,
    threshold = 7.0,
    judge,
    timeout = 300_000,
  } = options

  const modelConfig = toModelConfig(model)
  const judgeSetup = judge ? toJudgeConfig(judge) : undefined

  describe(`verdict: ${name}`, () => {
    const results: Array<{ id: string; score: number }> = []

    it('eval cases', async () => {
      // Load cases
      let cases: EvalCase[]
      if (Array.isArray(pack)) {
        cases = pack
      } else {
        const loaded = await loadEvalPack(
          pack,
          // Minimal config stub required by loadEvalPack
          { packs: [], models: [], judge: { model: 'none', blind: true, strategy: 'single', rubric: { accuracy: 0.4, completeness: 0.4, conciseness: 0.2 } }, name: '' } as never
        )
        cases = loaded.cases
      }

      expect(cases.length).toBeGreaterThan(0)

      // Run each case
      for (const c of cases) {
        const score = await scoreSingleCase(
          c,
          modelConfig,
          judgeSetup?.judgeModel,
          judgeSetup?.judgeConfig,
        )
        results.push({ id: c.id, score })

        // Per-case failure
        if (score < threshold) {
          throw new Error(
            `eval: ${c.id} (${score.toFixed(1)}/10) — below threshold ${threshold}`
          )
        }
      }
    }, timeout)

    afterAll(() => {
      if (results.length === 0) return
      const avg = results.reduce((s, r) => s + r.score, 0) / results.length
      if (avg < threshold) {
        const failing = results.filter(r => r.score < threshold)
        throw new Error(
          `eval suite "${name}": avg ${avg.toFixed(1)}/10 below threshold ${threshold} ` +
          `(${failing.length}/${results.length} cases failed)`
        )
      }
    })
  })
}
