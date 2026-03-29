/**
 * Verdict Programmatic API
 *
 * Use verdict as a library instead of (or in addition to) the CLI.
 *
 * @example
 * ```ts
 * import { runEvals, loadEvalPacks, type Config } from 'verdict'
 *
 * const config: Config = {
 *   name: 'My Evals',
 *   models: [{ id: 'local', provider: 'ollama', model: 'llama3' }],
 *   judge: { model: 'gpt-4o-mini' },
 *   packs: ['./eval-packs/general.yaml'],
 * }
 *
 * const packs = await loadEvalPacks(config.packs, config)
 * const result = await runEvals(config, packs, (msg) => console.log(msg))
 * console.log(result.summary)
 * ```
 */

// ─── Core runner ─────────────────────────────────────────────────────────────
export { runEvals, computeConfigHash, loadCheckpoint, getCheckpointPath } from './core/runner.js'

// ─── Config + pack loader ─────────────────────────────────────────────────────
export { loadConfig, loadEvalPack } from './core/config.js'

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

// ─── Database ────────────────────────────────────────────────────────────────
export {
  getDb,
  initSchema,
  saveRunResult,
  queryHistory,
  parseSince,
} from './db/client.js'

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
