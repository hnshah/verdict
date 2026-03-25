import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { Config, EvalPack, RunResult, ModelSummary, CaseResult, Checkpoint } from '../types/index.js'
import { callModel } from '../providers/compat.js'
import { judgeResponse } from '../judge/llm.js'
import { scoreDeterministic, isDeterministic } from '../judge/deterministic.js'

export function computeConfigHash(config: Config): string {
  const key = JSON.stringify({ models: config.models.map(m => m.id), judge: config.judge.model, packs: config.packs })
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12)
}

export function getCheckpointPath(outputDir: string): string {
  return path.join(outputDir, '.verdict-checkpoint.json')
}

export function loadCheckpoint(outputDir: string, configHash: string): Checkpoint | null {
  const cpPath = getCheckpointPath(outputDir)
  if (!fs.existsSync(cpPath)) return null
  try {
    const cp = JSON.parse(fs.readFileSync(cpPath, 'utf8')) as Checkpoint
    if (cp.configHash !== configHash) return null
    return cp
  } catch {
    return null
  }
}

function saveCheckpoint(outputDir: string, checkpoint: Checkpoint): void {
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(getCheckpointPath(outputDir), JSON.stringify(checkpoint, null, 2))
}

function deleteCheckpoint(outputDir: string): void {
  const cpPath = getCheckpointPath(outputDir)
  if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath)
}

export async function runEvals(
  config: Config,
  packs: EvalPack[],
  onProgress?: (msg: string) => void,
  resume?: boolean
): Promise<RunResult> {
  const configHash = computeConfigHash(config)
  const log = onProgress ?? (() => {})
  const allCases = packs.flatMap(p => p.cases)
  const modelIds = config.models.map(m => m.id)

  // Resume from checkpoint if requested
  let checkpoint: Checkpoint | null = null
  let runId: string
  if (resume) {
    checkpoint = loadCheckpoint(config.output.dir, configHash)
    if (checkpoint) {
      runId = checkpoint.runId
      log(`Resuming run ${runId} — ${checkpoint.completedCaseIds.length}/${allCases.length} cases already done`)
    } else {
      runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      log('No checkpoint found, starting fresh run')
    }
  } else {
    runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  }

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

  const cases: CaseResult[] = checkpoint ? [...checkpoint.partialResults] : []
  const completedIds = new Set(checkpoint?.completedCaseIds ?? [])
  const { concurrency } = config.run

  for (const evalCase of allCases) {
    // Skip already-completed cases when resuming
    if (completedIds.has(evalCase.id)) {
      log(`${evalCase.id}: skipping (already completed)`)
      // Rebuild summary from checkpoint results
      const existing = cases.find(c => c.case_id === evalCase.id)
      if (existing) {
        for (const [modelId, score] of Object.entries(existing.scores)) {
          if (summary[modelId]) {
            summary[modelId].avg_accuracy += score.accuracy
            summary[modelId].avg_completeness += score.completeness
            summary[modelId].avg_conciseness += score.conciseness
            summary[modelId].avg_total += score.total
            summary[modelId].cases_run++
            if (existing.winner === modelId) summary[modelId].wins++
            const resp = existing.responses[modelId]
            if (resp) {
              if (resp.cost_usd) summary[modelId].total_cost_usd += resp.cost_usd
              summary[modelId].avg_latency_ms += resp.latency_ms
            }
          }
        }
      }
      continue
    }

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

    // Save checkpoint after each case
    saveCheckpoint(config.output.dir, {
      runId,
      configHash,
      completedCaseIds: cases.map(c => c.case_id),
      partialResults: cases,
      startedAt: checkpoint?.startedAt ?? new Date().toISOString(),
    })
  }

  // Clean up checkpoint on completion
  deleteCheckpoint(config.output.dir)

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
