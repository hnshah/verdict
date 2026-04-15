import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'
import type { Config, EvalPack, RunResult, ModelSummary, CaseResult, Checkpoint, JudgeScore, Assertion, RunMeta } from '../types/index.js'
import { callModel, callModelMultiTurn, callModelWithTools } from '../providers/compat.js'
import { judgeResponse, judgeResponseCot } from '../judge/llm.js'
import { judgeFaithfulness } from '../judge/faithfulness.js'
import { scoreSimilar } from '../judge/similar.js'
import { scoreDeterministic, isDeterministic, scoreToolCall, scoreLatency, scoreCost } from '../judge/deterministic.js'
import { detectHardware, toRunResultFormat } from './hardware.js'
import { preloadModels } from './preload.js'

/**
 * Detect environment information
 */
function detectEnvironment(): { verdict_version: string, node_version: string, provider_versions: { ollama?: string, mlx?: string } } {
  const verdictVersion = '0.3.0' // TODO: Read from package.json
  const nodeVersion = process.version
  
  const providerVersions: { ollama?: string, mlx?: string } = {}
  
  // Try to get Ollama version
  try {
    const ollamaVersion = execSync('ollama --version 2>/dev/null || true', { encoding: 'utf-8' }).trim()
    if (ollamaVersion) {
      const match = ollamaVersion.match(/ollama version is ([\d.]+)/)
      if (match) providerVersions.ollama = match[1]
    }
  } catch {}
  
  // MLX version detection could go here
  // (would need to check if MLX server is running and query it)
  
  return {
    verdict_version: verdictVersion,
    node_version: nodeVersion,
    provider_versions: providerVersions
  }
}

/**
 * Extract eval pack metadata
 */
function extractEvalPackMetadata(packs: EvalPack[]): {
  file: string
  description?: string
  tags?: string[]
  difficulty?: string
  total_cases: number
  source?: string
  source_url?: string
} | undefined {
  if (packs.length === 0) return undefined
  
  // Use first pack for now (could combine multiple later)
  const pack = packs[0]
  
  return {
    file: 'eval-packs/' + (pack.name.toLowerCase().replace(/\s+/g, '-')) + '.yaml', // Approximation
    description: pack.description,
    total_cases: pack.cases.length,
    // TODO: Extract these from pack metadata if available
  }
}

/**
 * Build reproducibility command
 */
function buildReproCommand(config: Config, packNames: string[], modelIds: string[]): string {
  const packArg = packNames.length === 1 ? `-p ${packNames[0]}` : `-p ${packNames.join(',')}`
  const modelArg = modelIds.length === 1 ? `-m ${modelIds[0]}` : `-m ${modelIds.join(',')}`
  
  return `verdict run -c verdict.yaml ${packArg} ${modelArg}`
}

/**
 * Build model configs for reproducibility
 */
function buildModelConfigs(config: Config): Record<string, any> {
  const configs: Record<string, any> = {}
  
  for (const model of config.models) {
    configs[model.id] = {
      provider: model.provider,
      model: model.model,
      temperature: 0.7, // TODO: Get from actual config if available
      max_tokens: model.max_tokens,
      // TODO: Add quantization if available from model metadata
    }
  }
  
  return configs
}

export function scoreAssertion(
  assertion: Assertion,
  output: string,
  toolCalls?: import('../types/index.js').ToolCallResult[]
): JudgeScore | null {
  if (assertion.scorer === 'tool_call') {
    const expectedStr = typeof assertion.expected === 'string' ? assertion.expected : (assertion.expected?.[0] ?? '')
    return scoreToolCall(toolCalls, expectedStr)
  }
  if (isDeterministic(assertion.scorer)) {
    return scoreDeterministic(assertion.scorer, output, assertion.expected, assertion.schema)
  }
  // LLM scorer not supported in assertions (requires criteria/prompt context)
  return null
}

export function aggregateScores(
  scores: JudgeScore[],
  mode: 'min' | 'max' | 'avg' | 'weighted' = 'min',
  weights?: number[]
): JudgeScore {
  if (scores.length === 0) {
    return { accuracy: 0, completeness: 0, conciseness: 0, total: 0, reasoning: 'No assertions scored.' }
  }

  type NumericField = 'accuracy' | 'completeness' | 'conciseness' | 'total'
  const fields: NumericField[] = ['accuracy', 'completeness', 'conciseness', 'total']
  const reasoning = scores.map((s, i) => `[${i + 1}] ${s.reasoning}`).join(' | ')

  if (mode === 'min') {
    const vals: Record<NumericField, number> = { accuracy: 0, completeness: 0, conciseness: 0, total: 0 }
    for (const f of fields) vals[f] = Math.min(...scores.map(s => s[f] as number))
    return { ...vals, reasoning }
  }

  if (mode === 'max') {
    const vals: Record<NumericField, number> = { accuracy: 0, completeness: 0, conciseness: 0, total: 0 }
    for (const f of fields) vals[f] = Math.max(...scores.map(s => s[f] as number))
    return { ...vals, reasoning }
  }

  if (mode === 'avg' || mode === 'weighted') {
    const w = mode === 'weighted' && weights?.length === scores.length
      ? weights.map(x => x / weights.reduce((a, b) => a + b, 0))  // normalize
      : scores.map(() => 1 / scores.length)  // equal weights for avg

    const vals: Record<NumericField, number> = { accuracy: 0, completeness: 0, conciseness: 0, total: 0 }
    for (const f of fields) {
      vals[f] = +scores.reduce((sum, s, i) => sum + (s[f] as number) * w[i], 0).toFixed(1)
    }
    return { ...vals, reasoning }
  }

  // fallback
  return aggregateScores(scores, 'min')
}

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
  turns: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt?: string
): Promise<import('../types/index.js').ModelResponse> {
  const messages: Array<{ role: string; content: string }> = []
  let lastResponse: import('../types/index.js').ModelResponse | null = null

  for (const turn of turns) {
    if (turn.role === 'assistant' && turn.content === '__model__') {
      // Call the model with conversation history so far
      const resp = await callModelMultiTurn(modelConfig, messages, 0, systemPrompt)
      messages.push({ role: 'assistant', content: resp.text })
      lastResponse = resp
    } else {
      messages.push({ role: turn.role, content: turn.content })
    }
  }

  // If the last turn is a user message, we need one final model call
  const lastTurn = turns[turns.length - 1]
  if (lastTurn.role === 'user') {
    const resp = await callModelMultiTurn(modelConfig, messages, 0, systemPrompt)
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
  categoryFilter?: string[],
  preload: boolean = true,
  configFile?: string
): Promise<RunResult> {
  const configHash = computeConfigHash(config)
  const log = onProgress ?? (() => {})
  const allCases = packs.flatMap(p =>
    categoryFilter ? p.cases.filter(c => c.category !== undefined && categoryFilter.includes(c.category)) : p.cases
  )
  const modelIds = config.models.map(m => m.id)

  // Pre-load models if enabled
  if (preload) {
    await preloadModels(config.models, false)
  }

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

    log(`${evalCase.id}: running ${modelIds.length} model(s)`)
    const caseResult: CaseResult = {
      case_id: evalCase.id, prompt: evalCase.prompt,
      criteria: evalCase.criteria, responses: {}, scores: {},
    }

    // Run all models concurrently (chunked)
    const jobs = config.models.map(m => async () => {
      let resp
      if (evalCase.scorer === 'tool_call' && evalCase.tools && evalCase.tools.length > 0) {
        resp = await callModelWithTools(m, evalCase.prompt, evalCase.tools, 0, evalCase.system_prompt)
      } else if (evalCase.turns && evalCase.turns.length > 0) {
        resp = await runMultiTurn(m, evalCase.turns, evalCase.system_prompt)
      } else {
        resp = await callModel(m, evalCase.prompt, 0, evalCase.image, evalCase.system_prompt)
      }
      caseResult.responses[m.id] = resp
      if (resp.cost_usd) summary[m.id].total_cost_usd += resp.cost_usd
      summary[m.id].avg_latency_ms += resp.latency_ms
    })
    for (let i = 0; i < jobs.length; i += concurrency) {
      await Promise.all(jobs.slice(i, i + concurrency).map(fn => fn()))
    }

    // Judge each response (blind or deterministic)
    const usesDeterministic = isDeterministic(evalCase.scorer)
    if (!usesDeterministic && !evalCase.assertions) log(`${evalCase.id}: judging`)

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
        let score: JudgeScore

        if (evalCase.assertions && evalCase.assertions.length > 0) {
          // Multi-assertion mode: run each assertion, aggregate with configured mode
          const assertionScores: JudgeScore[] = []
          for (const assertion of evalCase.assertions) {
            const s = scoreAssertion(assertion, resp.text, resp.tool_calls)
            if (s) assertionScores.push(s)
          }
          score = aggregateScores(assertionScores)
        } else if (evalCase.scorer === 'similar') {
          const baseEmbeddingConfig = config.judge.embedding_model ?? {
            base_url: judgeModel.base_url ?? 'http://localhost:11434/v1',
            api_key: judgeModel.api_key ?? 'no-key',
            model: 'nomic-embed-text',
          }
          const embeddingConfig = {
            ...baseEmbeddingConfig,
            api_key: baseEmbeddingConfig.api_key || 'no-key'
          }
          score = await scoreSimilar(resp.text, String(evalCase.expected ?? ''), evalCase.threshold ?? 0.85, embeddingConfig)
        } else if (evalCase.scorer === 'latency') {
          score = scoreLatency(resp.latency_ms ?? 0, evalCase.threshold ?? 2000)
        } else if (evalCase.scorer === 'cost') {
          score = scoreCost(resp.cost_usd ?? 0, evalCase.threshold ?? 0.01)
        } else if (evalCase.scorer === 'faithfulness') {
          if (!evalCase.context) {
            console.warn(`[verdict] Case "${evalCase.prompt.slice(0, 40)}" uses faithfulness scorer but has no context field`)
          }
          score = await judgeFaithfulness(judgeModel, config.judge, evalCase.prompt, resp.text, evalCase.context ?? '')
        } else if (evalCase.scorer === 'tool_call') {
          score = scoreToolCall(resp.tool_calls, evalCase.expected_tool ?? '', evalCase.expected_args)
        } else if (usesDeterministic) {
          score = scoreDeterministic(evalCase.scorer, resp.text, evalCase.expected, evalCase.schema, evalCase.choices, evalCase.scorer_code)!
        } else if (evalCase.judge_style === 'cot_classify') {
          score = await judgeResponseCot(judgeModel, config.judge, evalCase.prompt, evalCase.criteria, resp.text, evalCase.cot_choices)
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

  // Collect metadata
  const hardware = detectHardware()
  const hwFormat = toRunResultFormat(hardware)
  const environment = detectEnvironment()
  const evalPackMetadata = extractEvalPackMetadata(packs)
  const packNames = packs.map(p => p.name)

  const runMeta: RunMeta = {
    run_id: runId,
    config_file: configFile || 'verdict.yaml',
    verdict_version: environment.verdict_version,
    hardware: `${hwFormat.cpu} ${hwFormat.ram_gb}GB`,
  }

  return {
    run_id: runId,
    name: config.name,
    timestamp: new Date().toISOString(),
    models: modelIds,
    cases,
    summary,
    run_meta: runMeta,
    hardware: hwFormat,
    environment,
    eval_pack: evalPackMetadata,
    judge: {
      model: config.judge.model,
      temperature: 0, // Judge uses temp=0 by default
      scoring_dimensions: ['accuracy', 'completeness', 'conciseness']
    },
    reproducibility: {
      command: buildReproCommand(config, packNames, modelIds),
      config_file: configFile || 'verdict.yaml',
      model_configs: buildModelConfigs(config)
    }
  }
}
