/**
 * Verdict Programmatic API
 *
 * Use verdict as a library instead of (or in addition to) the CLI.
 *
 * @example
 * ```ts
 * import { runEvalsFromConfig } from '@hnshah/verdict'
 *
 * const result = await runEvalsFromConfig('./verdict.yaml', {
 *   onProgress: msg => console.log(msg),
 * })
 * console.log(result.summary)
 * ```
 *
 * @example For finer control:
 * ```ts
 * import { runEvals, loadConfig, loadEvalPack } from '@hnshah/verdict'
 * import path from 'path'
 *
 * const config = loadConfig('./verdict.yaml')
 * const cfgDir = path.dirname(path.resolve('./verdict.yaml'))
 * const packs = config.packs.map(p => loadEvalPack(p, cfgDir))
 * const result = await runEvals(config, packs)
 * ```
 */

import path from 'path'
import { loadConfig as _loadConfig, loadEvalPack as _loadEvalPack } from './core/config.js'
import { runEvals as _runEvals } from './core/runner.js'
import type { Config, EvalPack, RunResult } from './types/index.js'

// ─── Core runner ─────────────────────────────────────────────────────────────
export { runEvals, computeConfigHash, loadCheckpoint, getCheckpointPath } from './core/runner.js'

// ─── Config + pack loader ─────────────────────────────────────────────────────
export { loadConfig, loadEvalPack } from './core/config.js'

// ─── Convenience helpers ─────────────────────────────────────────────────────

export interface RunEvalsFromConfigOptions {
  /** Progress callback — receives one line per case/judge action. */
  onProgress?: (msg: string) => void
  /** Resume from a previous checkpoint if one exists. */
  resume?: boolean
  /** Only run cases whose `category` is in this list. */
  categoryFilter?: string[]
  /**
   * Preload Ollama models before running (default true). Disable for
   * cloud-only configs or scripted runs where models are already warm.
   */
  preload?: boolean
  /**
   * Override the packs from the config file. When provided, the config's
   * `packs` list is ignored and these packs are loaded relative to the
   * config file's directory.
   */
  packs?: string[]
}

/**
 * One-call wrapper around `loadConfig` + `loadEvalPack` + `runEvals`. The
 * three-step boilerplate is the most common library entry point, so this
 * helper lets consumers drop into a single line:
 *
 * ```ts
 * const result = await runEvalsFromConfig('./verdict.yaml')
 * ```
 *
 * For finer control (custom pack lists, manual config mutation), call
 * `loadConfig` / `loadEvalPack` / `runEvals` directly.
 */
export async function runEvalsFromConfig(
  configPath: string,
  opts: RunEvalsFromConfigOptions = {}
): Promise<RunResult> {
  const config: Config = _loadConfig(configPath)
  const cfgDir = path.dirname(path.resolve(configPath))
  const packPaths = opts.packs ?? config.packs
  const packs: EvalPack[] = packPaths.map(p => _loadEvalPack(p, cfgDir))
  return _runEvals(
    config,
    packs,
    opts.onProgress,
    opts.resume,
    opts.categoryFilter,
    opts.preload ?? true,
    configPath
  )
}

// ─── Eval registry ──────────────────────────────────────────────────────────
export {
  loadRegistry,
  saveRegistry,
  registryAdd,
  registryRemove,
  registryList,
  registryResolve,
  registerBuiltinPacks,
  getRegistryPath,
} from './core/registry.js'
export type { Registry } from './core/registry.js'

// ─── Judges ──────────────────────────────────────────────────────────────────
export {
  judgeResponse,
  clearJudgeClientCache,
} from './judge/llm.js'

export {
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
} from './judge/deterministic.js'

// ─── Reporters ───────────────────────────────────────────────────────────────
export { generateMarkdownReport } from './reporter/markdown.js'

// ─── Router ──────────────────────────────────────────────────────────────────
export { VerdictRouter } from './router/index.js'

// ─── Database ────────────────────────────────────────────────────────────────
export {
  getDb,
  initSchema,
  saveRunResult,
  queryHistory,
  parseSince,
} from './db/client.js'

// ─── Inline score API ────────────────────────────────────────────────────────
export { verdictScore } from './score.js'
export type {
  VerdictScoreOptions,
  VerdictScoreModelOptions,
  VerdictScoreJudgeOptions,
  VerdictScoreResult,
} from './score.js'

// ─── Types (re-exported for consumers) ───────────────────────────────────────
export type {
  Config,
  ModelConfig,
  JudgeConfig,
  EvalCase,
  EvalPack,
  RunResult,
  ModelSummary,
  CaseResult,
  ToolDef,
  ToolCallResult,
} from './types/index.js'
