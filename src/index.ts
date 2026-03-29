export { loadConfig, loadEvalPack } from './core/config.js'
export { runEvals } from './core/runner.js'

export type {
  Config as VerdictConfig,
  EvalCase,
  EvalPack,
  ModelConfig,
  JudgeConfig,
  ModelResponse,
  JudgeScore,
  CaseResult,
  ModelSummary,
  RunResult as EvalResult,
} from './types/index.js'
