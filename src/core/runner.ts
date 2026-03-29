import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { Config, EvalPack, RunResult, ModelSummary, CaseResult, Checkpoint } from '../types/index.js'
import { callModel, callModelMultiTurn, callModelWithTools } from '../providers/compat.js'
import { judgeResponse } from '../judge/llm.js'
import { scoreDeterministic, isDeterministic, scoreToolCall } from '../judge/deterministic.js'
import { log as vlog } from '../utils/logger.js'

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

async function runMultiTurn(
  modelConfig: import('../types/index.js').ModelConfig,
  turns: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<import('../types/index.js').ModelResponse> {
  const messages: Array<{ role: string; content: string }> = []
  let lastResponse: import('../types/index.js').ModelResponse | null = null

  for (const turn of turns) {
    if (turn.role === 'assistant' && turn.content === '__model__') {
      // Call the model with conversation history so far
      const resp = await callModelMultiTurn(modelConfig, messages)
      messages.push({ role: 'assistant', content: resp.text })
      lastResponse = resp
    } else {
      messages.push({ role: turn.role, content: turn.content })
    }
  }

  // If the last turn is a user message, we need one final model call
  const lastTurn = turns[turns.length - 1]
  if (lastTurn.role === 'user') {
    const resp = await callModelMultiTurn(modelConfig, messages)
    lastResponse = resp
  }

  if (!lastResponse) {
    return {
      model_id: modelConfig.id, text: '', input_tokens: 0,
      output_tokens: 0, latency_ms: 0, error: 'No model response generated in multi-turn',
    }
  }

  return lastResponse
}

export async function runEvals(
  config: Config,
  packs: EvalPack[],
  onProgress?: (msg: string) => void,
  resume?: boolean,
  categoryFilter?: string[]
): Promise<RunResult> {
  const configHash = computeConfigHash(config)
  const log = onProgress ?? (() => {})
  const allCases = packs.flatMap(p =>
    categoryFilter ? p.cases.filter(c => c.category !== undefined && categoryFilter.includes(c.category)) : p.cases
  )
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
      avg_conciseness: 0, avg_latency_ms: 0, avg_tokens_per_sec: 0,
      total_cost_usd: 0, win_rate: 0, wins: 0, cases_run: 0, avg_solve_rate: 0,
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

    const caseStart = Date.now()
    log(`${evalCase.id}: running ${modelIds.length} model(s)`)
    const caseResult: CaseResult = {
      case_id: evalCase.id, prompt: evalCase.prompt,
      criteria: evalCase.criteria, responses: {}, scores: {},
    }

    vlog('debug', `case ${evalCase.id}: prompt = ${evalCase.prompt}`)
    if (evalCase.criteria) vlog('debug', `case ${evalCase.id}: criteria = ${evalCase.criteria}`)

    // Run all models concurrently (chunked)
    const jobs = config.models.map(m => async () => {
      vlog('debug', `${evalCase.id} -> ${m.id}: sending prompt to ${m.model} at ${m.base_url}`)
      const modelStart = Date.now()
      let resp
      if (evalCase.scorer === 'tool_call' && evalCase.tools && evalCase.tools.length > 0) {
        resp = await callModelWithTools(m, evalCase.prompt, evalCase.tools)
      } else if (evalCase.turns && evalCase.turns.length > 0) {
        resp = await runMultiTurn(m, evalCase.turns)
      } else {
        resp = await callModel(m, evalCase.prompt, 0, evalCase.image)
      }
      const modelDuration = Date.now() - modelStart
      caseResult.responses[m.id] = resp
      if (resp.cost_usd) summary[m.id].total_cost_usd += resp.cost_usd
      summary[m.id].avg_latency_ms += resp.latency_ms

      vlog('verbose', `${evalCase.id} -> ${m.id}: ${modelDuration}ms, ${resp.input_tokens}+${resp.output_tokens} tokens${resp.error ? `, error: ${resp.error}` : ''}`)
      vlog('debug', `${evalCase.id} -> ${m.id}: response body`, resp.text)
    })
    for (let i = 0; i < jobs.length; i += concurrency) {
      await Promise.all(jobs.slice(i, i + concurrency).map(fn => fn()))
    }

    // Judge each response (blind or deterministic)
    const usesDeterministic = isDeterministic(evalCase.scorer)
    if (!usesDeterministic) log(`${evalCase.id}: judging`)

    for (const [modelId, resp] of Object.entries(caseResult.responses)) {
      const hasContent = resp.text || (evalCase.scorer === 'tool_call' && resp.tool_calls?.length)
      if (resp.error || !hasContent) {
        caseResult.scores[modelId] = {
          accuracy: 0, completeness: 0, conciseness: 0, total: 0,
          reasoning: resp.error ?? 'no response',
        }
        continue
      }
      try {
        let score
        if (evalCase.scorer === 'tool_call') {
          score = scoreToolCall(resp.tool_calls, evalCase.expected_tool ?? '', evalCase.expected_args)
        } else if (usesDeterministic) {
          score = scoreDeterministic(evalCase.scorer, resp.text, evalCase.expected, evalCase.schema, evalCase.choices)!
        } else {
          vlog('debug', `${evalCase.id} -> ${modelId}: sending to judge (${judgeModel.model})`)
          score = await judgeResponse(judgeModel, config.judge, evalCase.prompt, evalCase.criteria, resp.text)
        }
        caseResult.scores[modelId] = score
        vlog('verbose', `${evalCase.id} -> ${modelId}: score=${score.total}/10 (acc=${score.accuracy} comp=${score.completeness} conc=${score.conciseness})`)
        if (score.reasoning) vlog('debug', `${evalCase.id} -> ${modelId}: reasoning`, score.reasoning)
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

    const caseDuration = Date.now() - caseStart
    vlog('verbose', `${evalCase.id}: completed in ${caseDuration}ms${winner ? `, winner: ${winner[0]}` : ''}`)

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
