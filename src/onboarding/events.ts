/**
 * Onboarding engine types — the typed spine the UI and headless renderers
 * subscribe to. The Snapshot/Plan/Mark shapes are persisted, so they get
 * Zod schemas; transient runtime state (OnboardingState, OnboardingEvent)
 * uses plain TypeScript.
 */

import { z } from 'zod'

// ─── Snapshot (detect output) ───────────────────────────────────────────────

export const OllamaSnapshotSchema = z.object({
  installed: z.boolean(),
  binPath: z.string().optional(),
  version: z.string().optional(),
  daemonRunning: z.boolean(),
  installedModels: z.array(z.string()).default([]),
})
export type OllamaSnapshot = z.infer<typeof OllamaSnapshotSchema>

export const MlxSnapshotSchema = z.object({
  appleSilicon: z.boolean(),
  mlxLmInstalled: z.boolean(),
  serverRunning: z.boolean(),
  port: z.number().optional(),
})
export type MlxSnapshot = z.infer<typeof MlxSnapshotSchema>

export const LmStudioSnapshotSchema = z.object({
  appInstalled: z.boolean(),
  serverRunning: z.boolean(),
})
export type LmStudioSnapshot = z.infer<typeof LmStudioSnapshotSchema>

export const CloudSnapshotSchema = z.object({
  openrouterKey: z.boolean(),
  anthropicKey: z.boolean(),
  openaiKey: z.boolean(),
  groqKey: z.boolean(),
})
export type CloudSnapshot = z.infer<typeof CloudSnapshotSchema>

export const ConfigSnapshotSchema = z.object({
  exists: z.boolean(),
  path: z.string().optional(),
  valid: z.boolean().optional(),
  issues: z.array(z.string()).default([]),
  modelCount: z.number().optional(),
})
export type ConfigSnapshot = z.infer<typeof ConfigSnapshotSchema>

export const HardwareSnapshotSchema = z.object({
  cpu: z.string(),
  cpuCores: z.number(),
  cpuArch: z.string(),
  ram: z.string(),
  ramGB: z.number(),
  freeDiskGB: z.number().optional(),
  os: z.string(),
  osVersion: z.string(),
  gpu: z.string().optional(),
})
export type HardwareSnapshot = z.infer<typeof HardwareSnapshotSchema>

export const SnapshotSchema = z.object({
  capturedAt: z.string(),
  hardware: HardwareSnapshotSchema,
  ollama: OllamaSnapshotSchema,
  mlx: MlxSnapshotSchema,
  lmstudio: LmStudioSnapshotSchema,
  cloud: CloudSnapshotSchema,
  config: ConfigSnapshotSchema,
  network: z.object({ online: z.boolean() }),
  homebrew: z.object({ installed: z.boolean(), path: z.string().optional() }),
})
export type Snapshot = z.infer<typeof SnapshotSchema>

// ─── Plan (planner output) ──────────────────────────────────────────────────

export const InstallStepSchema = z.object({
  id: z.enum([
    'install-ollama',
    'start-ollama',
    'capture-cloud-key',
    'install-mlx-lm',
  ]),
  label: z.string(),
  required: z.boolean(),
  /** Display-only hint; not enforced. */
  estimatedSeconds: z.number().optional(),
  /** For install-ollama: which install method. */
  method: z.enum(['brew', 'curl']).optional(),
})
export type InstallStep = z.infer<typeof InstallStepSchema>

export const PlannedModelSchema = z.object({
  name: z.string(),
  provider: z.enum(['ollama']),
  role: z.enum(['general-small', 'general-mid', 'coder', 'judge']),
  paramsB: z.number(),
  defaultQuant: z.string(),
  estimatedSizeGB: z.number(),
})
export type PlannedModel = z.infer<typeof PlannedModelSchema>

export const PlannedCloudModelSchema = z.object({
  id: z.string(),
  base_url: z.string(),
  apiKeyEnv: z.string(),
  model: z.string(),
  costPer1mInput: z.number().optional(),
  costPer1mOutput: z.number().optional(),
})
export type PlannedCloudModel = z.infer<typeof PlannedCloudModelSchema>

export const PlanSchema = z.object({
  intent: z.enum(['config-only', 'cloud-only', 'reuse-local', 'local-first']),
  installSteps: z.array(InstallStepSchema).default([]),
  modelsToPull: z.array(PlannedModelSchema).default([]),
  /** Cloud models to register in verdict.yaml (without pulling). */
  cloudModels: z.array(PlannedCloudModelSchema).default([]),
  /** Already-installed local models to reuse. */
  reuseModels: z.array(z.string()).default([]),
  judge: z.object({
    modelId: z.string(),
    rationale: z.string(),
  }),
  config: z.object({
    action: z.enum(['create', 'merge', 'replace-with-backup', 'leave']),
    targetPath: z.string(),
  }),
  rationale: z.string(),
  estimatedDownloadGB: z.number(),
  estimatedDurationMin: z.tuple([z.number(), z.number()]),
})
export type Plan = z.infer<typeof PlanSchema>

export const PlanSelectionsSchema = z.object({
  modelsToPull: z.array(z.string()),
  judgeModelId: z.string(),
  installMLX: z.boolean(),
  cloudKey: z
    .object({
      provider: z.enum(['openrouter', 'anthropic', 'openai', 'groq']),
      key: z.string(),
    })
    .optional(),
})
export type PlanSelections = z.infer<typeof PlanSelectionsSchema>

// ─── State machine ──────────────────────────────────────────────────────────

export type DetectStep =
  | 'hardware'
  | 'ollama-bin'
  | 'ollama-daemon'
  | 'mlx'
  | 'lmstudio'
  | 'cloud'
  | 'network'
  | 'homebrew'
  | 'config'

export type DetectProgress = Record<DetectStep, 'pending' | 'running' | 'done'>

export interface InstallStepProgress {
  step: InstallStep
  state: 'pending' | 'running' | 'done' | 'failed'
  log: string[]
  errorMessage?: string
}

export interface PullTaskView {
  modelName: string
  phase:
    | 'queued'
    | 'starting'
    | 'manifest'
    | 'downloading'
    | 'verifying'
    | 'writing'
    | 'retrying'
    | 'done'
    | 'failed'
    | 'canceled'
  percent: number // 0..100; -1 if indeterminate
  bytesPerSec: number
  etaSeconds: number
  attempt: number
  errorMessage?: string
}

export interface PullAggregateView {
  overallPercent: number
  doneTasks: number
  totalTasks: number
  failedTasks: number
}

export interface VerifyResult {
  ok: boolean
  durationMs: number
  modelCalled: string
  judgeCalled: string
  exampleResponse: string
  exampleScore: number
  failures: Array<{ step: string; error: string }>
}

export interface DoneSummary {
  pulledModels: string[]
  reusedModels: string[]
  configPath: string
  configBackupPath?: string
  smokeScore?: number
  totalDurationMs: number
}

export type OnboardingState =
  | { kind: 'welcome' }
  | { kind: 'detect'; progress: DetectProgress }
  | { kind: 'plan'; snapshot: Snapshot; plan: Plan }
  | { kind: 'consent'; snapshot: Snapshot; plan: Plan; selections: PlanSelections }
  | {
      kind: 'install'
      plan: Plan
      steps: InstallStepProgress[]
      currentStep: number
    }
  | {
      kind: 'pull'
      plan: Plan
      tasks: Record<string, PullTaskView>
      aggregate: PullAggregateView
    }
  | {
      kind: 'configure'
      previewYaml: string
      diff: string | null
      hasExisting: boolean
      action: Plan['config']['action']
    }
  | { kind: 'verify'; result: VerifyResult | null }
  | { kind: 'done'; summary: DoneSummary }
  | { kind: 'cancelled'; from: OnboardingStateKind; reason?: string }
  | {
      kind: 'failed'
      from: OnboardingStateKind
      error: string
      recoverable: boolean
    }

export type OnboardingStateKind = OnboardingState['kind']

export type OnboardingEvent =
  // User-driven
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'cancel'; reason?: string }
  | { type: 'skip-onboarding' }
  | { type: 'edit-plan'; selections: PlanSelections }
  | { type: 'choose-config-action'; action: Plan['config']['action'] }
  | { type: 'consent-given' }
  | { type: 'retry' }
  // Engine-internal (folded back into reducer)
  | { type: '__detect-progress'; data: DetectProgress }
  | { type: '__detect-complete'; snapshot: Snapshot; plan: Plan }
  | {
      type: '__install-step-progress'
      index: number
      line: string
      state: InstallStepProgress['state']
    }
  | { type: '__install-step-failed'; index: number; error: string }
  | { type: '__install-complete' }
  | {
      type: '__pull-progress'
      tasks: Record<string, PullTaskView>
      aggregate: PullAggregateView
    }
  | { type: '__pull-complete' }
  | { type: '__configure-ready'; previewYaml: string; diff: string | null; hasExisting: boolean }
  | { type: '__configure-written'; configPath: string; backupPath?: string }
  | { type: '__verify-complete'; result: VerifyResult }
  | { type: '__error'; error: string; recoverable: boolean }

// ─── Persisted mark (resume across crashes) ─────────────────────────────────

export const OnboardingMarkSchema = z.object({
  version: z.literal(1),
  status: z.enum(['in-progress', 'completed', 'skipped', 'cancelled']),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  lastCompletedState: z
    .enum([
      'welcome',
      'detect',
      'plan',
      'consent',
      'install',
      'pull',
      'configure',
      'verify',
      'done',
    ])
    .optional(),
  snapshot: SnapshotSchema.optional(),
  plan: PlanSchema.optional(),
  /** Models successfully pulled this session (skip re-pull on resume). */
  pulledModels: z.array(z.string()).default([]),
  /** Set when WE started `ollama serve` so we know whether to clean up on cancel. */
  ollamaPidWeStarted: z.number().optional(),
})
export type OnboardingMark = z.infer<typeof OnboardingMarkSchema>

// ─── Log event (shown in install/pull screens, and headless mode) ──────────

export interface OnboardingLog {
  ts: number
  level: 'info' | 'warn' | 'error'
  msg: string
  source?: string
}
