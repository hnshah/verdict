import { z } from 'zod'

// ─── Model config ────────────────────────────────────────────────────────────

export const ModelConfigSchema = z.object({
  id: z.string(),
  // Provider shortcuts with deep integration
  provider: z.enum(['ollama', 'mlx']).optional(),
  // Or raw OpenAI-compat endpoint (covers everything else: OpenRouter, Groq, OpenAI, etc.)
  base_url: z.string().optional(),
  api_key: z.string().default('none'),
  model: z.string(),
  // Ollama-specific
  host: z.string().optional(),
  // MLX-specific
  port: z.number().default(8080),
  // Metadata
  tags: z.array(z.string()).default([]),
  cost_per_1m_input: z.number().optional(),
  cost_per_1m_output: z.number().optional(),
  timeout_ms: z.number().default(120_000),
  max_tokens: z.number().default(1024),
})
export type ModelConfig = z.infer<typeof ModelConfigSchema>

export const JudgeConfigSchema = z.object({
  model: z.string(),
  blind: z.boolean().default(true),
  strategy: z.enum(['single', 'average']).default('single'),
  rubric: z.object({
    accuracy: z.number().default(0.4),
    completeness: z.number().default(0.4),
    conciseness: z.number().default(0.2),
  }).default({}),
})
export type JudgeConfig = z.infer<typeof JudgeConfigSchema>

export const ConfigSchema = z.object({
  name: z.string().default('My Evals'),
  models: z.array(ModelConfigSchema).min(1),
  judge: JudgeConfigSchema,
  packs: z.array(z.string()).default(['./eval-packs/general.yaml']),
  run: z.object({
    concurrency: z.number().default(3),
    retries: z.number().default(2),
    cache: z.boolean().default(true),
  }).default({}),
  output: z.object({
    dir: z.string().default('./results'),
    formats: z.array(z.enum(['json', 'markdown', 'slack'])).default(['json', 'markdown']),
    delta: z.boolean().default(true),
  }).default({}),
})
export type Config = z.infer<typeof ConfigSchema>

// ─── Tool definitions ────────────────────────────────────────────────────────

export const ToolDefSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),
})
export type ToolDef = z.infer<typeof ToolDefSchema>

export interface ToolCallResult {
  name: string
  arguments: Record<string, unknown>
}

// ─── Eval packs ──────────────────────────────────────────────────────────────

export const EvalCaseSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  ideal_latency_ms: z.number().optional(),
  prompt: z.string().default(''),
  criteria: z.string(),
  expected: z.union([z.string(), z.array(z.string())]).optional(),
  tags: z.array(z.string()).default([]),
  // scorer: 'llm' uses LLM judge (default), 'json' parses output as JSON (pass/fail),
  // 'exact' checks exact string match, 'contains' checks substring presence,
  // 'jsonschema' validates JSON output against a schema, 'tool_call' scores tool usage
  // 'multiple_choice' scores A/B/C/D answers; 'regex' matches patterns
  scorer: z.enum(['llm', 'json', 'exact', 'contains', 'fuzzy_match', 'jsonschema', 'tool_call', 'multiple_choice', 'regex']).default('llm'),
  choices: z.array(z.string()).optional(),
  schema: z.record(z.unknown()).optional(),
  turns: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  image: z.string().optional(),
  tools: z.array(ToolDefSchema).optional(),
  expected_tool: z.string().optional(),
  expected_args: z.record(z.unknown()).optional(),
  judge_type: z.enum(['llm', 'reference', 'keyword']).default('llm'),
  max_tokens: z.number().optional(),
})
export type EvalCase = z.infer<typeof EvalCaseSchema>

export const EvalPackSchema = z.object({
  name: z.string(),
  version: z.string().default('1.0.0'),
  description: z.string().optional(),
  cases: z.array(EvalCaseSchema),
})
export type EvalPack = z.infer<typeof EvalPackSchema>

// ─── Results ─────────────────────────────────────────────────────────────────

export interface ModelResponse {
  model_id: string
  text: string
  input_tokens: number
  output_tokens: number
  latency_ms: number
  cost_usd?: number
  error?: string
  tool_calls?: ToolCallResult[]
}

export interface JudgeScore {
  accuracy: number
  completeness: number
  conciseness: number
  total: number
  reasoning: string
}

export interface CaseResult {
  case_id: string
  prompt: string
  criteria: string
  responses: Record<string, ModelResponse>
  scores: Record<string, JudgeScore>
  winner?: string
  solve_rates?: Record<string, number>
}

export interface ModelSummary {
  model_id: string
  avg_total: number
  avg_accuracy: number
  avg_completeness: number
  avg_conciseness: number
  avg_latency_ms: number
  avg_tokens_per_sec: number
  total_cost_usd: number
  win_rate: number
  wins: number
  cases_run: number
  avg_solve_rate: number
}

export interface RunResult {
  run_id: string
  name: string
  timestamp: string
  models: string[]
  cases: CaseResult[]
  summary: Record<string, ModelSummary>
  synthesis?: SynthesisResult
  baselineComparison?: BaselineComparison
}

// ─── Checkpoint ──────────────────────────────────────────────────────────────

export interface Checkpoint {
  runId: string
  configHash: string
  completedCaseIds: string[]
  partialResults: CaseResult[]
  startedAt: string
}

// ─── Synthesis ───────────────────────────────────────────────────────────────

export interface SynthesisResult {
  verdict: 'CLEAR' | 'LEAN' | 'INCONCLUSIVE'
  recommendation: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  keyFinding: string
  caveats: string
}

// ─── Baseline ────────────────────────────────────────────────────────────────

export interface BaselineDelta {
  model: string
  scoreA: number
  scoreB: number
  delta: number
  pctChange: number
  regression: boolean
}

export interface BaselineComparison {
  baselineName: string
  baselineDate: string
  deltas: BaselineDelta[]
  newModels: string[]
  removedModels: string[]
  regressionAlert: boolean
}

// ─── Slack ───────────────────────────────────────────────────────────────────

export interface SlackCard {
  winner: string
  winnerScore: number
  runId: string
  synthesis?: SynthesisResult
  regressionAlert: boolean
  markdownPath: string
}

// ─── Discovery ───────────────────────────────────────────────────────────────

export interface DiscoveredModel {
  provider: 'ollama' | 'mlx' | 'lmstudio'
  id: string               // suggested verdict model id
  model: string            // model name
  base_url: string
  size_gb?: number
  is_moe?: boolean         // detected MoE architecture
  tags: string[]
}
