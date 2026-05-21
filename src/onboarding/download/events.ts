/**
 * Download-engine specific event types. Kept separate from the broader
 * onboarding event union so the engine is reusable outside onboarding
 * (e.g., a future `verdict pull <model>` command).
 */

export type TaskPhase =
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

export interface LayerProgress {
  digest: string
  total: number // bytes
  completed: number // bytes
}

export interface TaskState {
  modelName: string
  provider: 'ollama'
  phase: TaskPhase
  layers: Record<string, LayerProgress>
  totalBytes: number
  completedBytes: number
  percent: number // 0..100; -1 if indeterminate
  bytesPerSec: number
  etaSeconds: number // -1 if unknown
  attempt: number
  maxAttempts: number
  lastStatusLine: string
  startedAt: number
  endedAt?: number
  errorMessage?: string
}

export interface AggregateState {
  totalTasks: number
  doneTasks: number
  failedTasks: number
  inFlightTasks: number
  queuedTasks: number
  overallPercent: number
  startedAt: number
}

export interface EngineSnapshot {
  tasks: Record<string, TaskState>
  aggregate: AggregateState
}

export type DownloadEvent =
  | { type: 'task-queued'; task: TaskState }
  | { type: 'task-started'; task: TaskState }
  | { type: 'task-progress'; task: TaskState }
  | { type: 'task-phase'; task: TaskState; from: TaskPhase; to: TaskPhase }
  | { type: 'task-retrying'; task: TaskState; delayMs: number }
  | { type: 'task-done'; task: TaskState }
  | { type: 'task-failed'; task: TaskState; error: string }
  | { type: 'task-canceled'; task: TaskState }
  | { type: 'engine-done'; summary: DownloadSummary }
  | { type: 'engine-canceled' }
  | { type: 'log'; modelName: string | null; line: string }

export interface DownloadRequest {
  modelName: string
  provider: 'ollama'
}

export interface DownloadSummary {
  succeeded: string[]
  failed: Array<{ name: string; error: string }>
  canceled: string[]
  durationMs: number
}

/**
 * Per-pull Ollama API event after our internal normalization. Used by the
 * provider adapter (`ollama-pull.ts`) to communicate progress back to the
 * engine in a stable shape — the upstream `/api/pull` line format is
 * intentionally not exposed beyond the adapter.
 */
export type AdapterEvent =
  | { type: 'phase'; phase: 'manifest' | 'downloading' | 'verifying' | 'writing' }
  | {
      type: 'layer-progress'
      digest: string
      total: number
      completed: number
    }
  | { type: 'log'; line: string }
  | { type: 'done' }
  | { type: 'error'; error: string; retriable: boolean }
