/**
 * Smoke verification — run a 2-prompt in-memory eval against the configured
 * model + judge. Used as the final gate of onboarding: if this succeeds, the
 * user knows verdict actually works on their machine end-to-end.
 *
 * We do NOT write the smoke pack to disk — users would wonder what
 * `smoke.yaml` is. The pack is built in-memory and passed straight to
 * `runEvals()`.
 */

import { loadConfig } from '../core/config.js'
import { runEvals } from '../core/runner.js'
import type { EvalPack, RunResult } from '../types/index.js'
import type { VerifyResult } from './events.js'

const SMOKE_PACK: EvalPack = {
  name: 'Onboarding smoke',
  version: '1.0.0',
  description: 'Two prompts that prove the model + judge + DB pipeline works.',
  cases: [
    {
      id: 'smoke-math',
      prompt: 'What is 2+2? Answer with the number only.',
      criteria: 'The answer is 4. A correct answer is a response containing "4" with no incorrect arithmetic claims.',
      tags: ['smoke'],
      scorer: 'llm',
      judge_type: 'llm',
      judge_style: 'standard',
      max_tokens: 64,
    },
    {
      id: 'smoke-hello',
      prompt: 'Reply with the single word: hello',
      criteria: 'The response is the word "hello" (case-insensitive), optionally with trailing punctuation.',
      tags: ['smoke'],
      scorer: 'llm',
      judge_type: 'llm',
      judge_style: 'standard',
      max_tokens: 32,
    },
  ],
}

export interface RunSmokeOptions {
  /** Path to verdict.yaml. */
  configPath: string
  /** Wall-clock cap. Default 60s. */
  timeoutMs?: number
  /** Optional progress callback. */
  onProgress?: (msg: string) => void
}

export async function runSmokeEval(opts: RunSmokeOptions): Promise<VerifyResult> {
  const start = Date.now()
  const timeoutMs = opts.timeoutMs ?? 60_000
  let config
  try {
    config = loadConfig(opts.configPath)
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      modelCalled: '',
      judgeCalled: '',
      exampleResponse: '',
      exampleScore: 0,
      failures: [{ step: 'load-config', error: err instanceof Error ? err.message : String(err) }],
    }
  }

  // Cap the smoke eval to 1 candidate model (the first non-judge) — keep
  // it fast. If only one model is configured, use it.
  const judgeId = config.judge.model
  const candidate = config.models.find(m => m.id !== judgeId) ?? config.models[0]
  if (!candidate) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      modelCalled: '',
      judgeCalled: judgeId,
      exampleResponse: '',
      exampleScore: 0,
      failures: [{ step: 'pick-model', error: 'no candidate model in config' }],
    }
  }

  // Restrict the run to just the candidate + judge to keep it fast.
  const restrictedConfig = {
    ...config,
    models: config.models.filter(m => m.id === candidate.id || m.id === judgeId),
    run: { ...config.run, concurrency: 1, retries: 0 },
  }

  // Race against the timeout. We don't have a cancel signal in runEvals, so
  // a timeout becomes "best-effort" — runEvals will keep running in the
  // background, but we report timeout to the caller.
  const runPromise: Promise<RunResult> = runEvals(
    restrictedConfig,
    [SMOKE_PACK],
    msg => opts.onProgress?.(msg),
    false,
    undefined,
    false,
    opts.configPath
  )
  const timeoutSentinel = Symbol('timeout')
  const timeoutPromise = new Promise<typeof timeoutSentinel>(resolve =>
    setTimeout(() => resolve(timeoutSentinel), timeoutMs)
  )
  const raceResult = await Promise.race([runPromise, timeoutPromise])

  if (raceResult === timeoutSentinel) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      modelCalled: candidate.id,
      judgeCalled: judgeId,
      exampleResponse: '',
      exampleScore: 0,
      failures: [{ step: 'timeout', error: `Smoke eval did not finish within ${timeoutMs}ms` }],
    }
  }

  const result = raceResult as RunResult
  return summarize(result, candidate.id, judgeId, Date.now() - start)
}

function summarize(
  result: RunResult,
  modelId: string,
  judgeId: string,
  durationMs: number
): VerifyResult {
  const failures: VerifyResult['failures'] = []

  const summary = result.summary[modelId]
  if (!summary || summary.cases_run === 0) {
    failures.push({ step: 'model-call', error: `No cases ran for model ${modelId}` })
  }

  let exampleResponse = ''
  let exampleScore = 0
  const firstCase = result.cases[0]
  if (firstCase) {
    const response = firstCase.responses[modelId]
    if (response?.error) {
      failures.push({ step: 'model-call', error: response.error })
    } else if (response) {
      exampleResponse = (response.text ?? '').slice(0, 200)
    }
    const score = firstCase.scores[modelId]
    if (score) exampleScore = score.total
    else if (!response?.error)
      failures.push({ step: 'judge', error: 'judge returned no score' })
  }

  const ok = failures.length === 0 && exampleResponse.length > 0
  return {
    ok,
    durationMs,
    modelCalled: modelId,
    judgeCalled: judgeId,
    exampleResponse,
    exampleScore,
    failures,
  }
}
