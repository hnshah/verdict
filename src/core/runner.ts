import type { Config, EvalPack, RunResult, ModelSummary, CaseResult } from '../types/index.js'
import { callModel } from '../providers/compat.js'
import { judgeResponse } from '../judge/llm.js'
import { scoreDeterministic, isDeterministic } from '../judge/deterministic.js'

export async function runEvals(
  config: Config,
  packs: EvalPack[],
  onProgress?: (msg: string) => void
): Promise<RunResult> {
  const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const log = onProgress ?? (() => {})
  const allCases = packs.flatMap(p => p.cases)
  const modelIds = config.models.map(m => m.id)

  const judgeModel = config.models.find(m => m.id === config.judge.model)
  if (!judgeModel) throw new Error(`Judge model '${config.judge.model}' not found in models list`)

  const summary: Record<string, ModelSummary> = {}
  for (const id of modelIds) {
    summary[id] = {
      model_id: id, avg_total: 0, avg_accuracy: 0, avg_completeness: 0,
      avg_conciseness: 0, avg_latency_ms: 0, total_cost_usd: 0,
      win_rate: 0, wins: 0, cases_run: 0,
    }
  }

  const cases: CaseResult[] = []
  const { concurrency } = config.run

  for (const evalCase of allCases) {
    log(`${evalCase.id}: running ${modelIds.length} model(s)`)
    const caseResult: CaseResult = {
      case_id: evalCase.id, prompt: evalCase.prompt,
      criteria: evalCase.criteria, responses: {}, scores: {},
    }

    // Run all models concurrently (chunked)
    const jobs = config.models.map(m => async () => {
      const resp = await callModel(m, evalCase.prompt)
      caseResult.responses[m.id] = resp
      if (resp.cost_usd) summary[m.id].total_cost_usd += resp.cost_usd
      summary[m.id].avg_latency_ms += resp.latency_ms
    })
    for (let i = 0; i < jobs.length; i += concurrency) {
      await Promise.all(jobs.slice(i, i + concurrency).map(fn => fn()))
    }

    // Judge each response (blind or deterministic)
    const usesDeterministic = isDeterministic(evalCase.scorer)
    if (!usesDeterministic) log(`${evalCase.id}: judging`)

    for (const [modelId, resp] of Object.entries(caseResult.responses)) {
      if (resp.error || !resp.text) {
        caseResult.scores[modelId] = {
          accuracy: 0, completeness: 0, conciseness: 0, total: 0,
          reasoning: resp.error ?? 'no response',
        }
        continue
      }
      try {
        let score
        if (usesDeterministic) {
          score = scoreDeterministic(evalCase.scorer, resp.text, evalCase.expected)!
        } else {
          score = await judgeResponse(judgeModel, config.judge, evalCase.prompt, evalCase.criteria, resp.text)
        }
        caseResult.scores[modelId] = score
        summary[modelId].avg_accuracy += score.accuracy
        summary[modelId].avg_completeness += score.completeness
        summary[modelId].avg_conciseness += score.conciseness
        summary[modelId].avg_total += score.total
        summary[modelId].cases_run++
      } catch (err) {
        caseResult.scores[modelId] = {
          accuracy: 0, completeness: 0, conciseness: 0, total: 0,
          reasoning: `judge error: ${err}`,
        }
      }
    }

    // Find winner
    const winner = Object.entries(caseResult.scores)
      .filter(([, s]) => s.total > 0)
      .sort((a, b) => b[1].total - a[1].total)[0]
    if (winner) { caseResult.winner = winner[0]; summary[winner[0]].wins++ }

    cases.push(caseResult)
  }

  // Averages
  for (const id of modelIds) {
    const s = summary[id]
    const n = s.cases_run
    if (n > 0) {
      s.avg_accuracy = +(s.avg_accuracy / n).toFixed(2)
      s.avg_completeness = +(s.avg_completeness / n).toFixed(2)
      s.avg_conciseness = +(s.avg_conciseness / n).toFixed(2)
      s.avg_total = +(s.avg_total / n).toFixed(2)
      s.avg_latency_ms = +(s.avg_latency_ms / Math.max(n, 1))
      s.win_rate = +((s.wins / cases.length) * 100).toFixed(1)
    }
  }

  return {
    run_id: runId, name: config.name,
    timestamp: new Date().toISOString(),
    models: modelIds, cases, summary,
  }
}
