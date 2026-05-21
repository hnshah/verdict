/**
 * Parallel download orchestrator.
 *
 * - Bounded concurrency via hand-rolled semaphore (default 2, max 4).
 * - Exponential retry on retriable errors (1s, 3s, 9s; max 3 attempts).
 * - AbortController for cancel; cleanly aborts in-flight fetches and
 *   refuses to start queued tasks.
 * - Throttled progress emission (~4 events/sec per task) so UI consumers
 *   don't drown.
 *
 * The engine is provider-agnostic via an injectable `adapter` — for v1
 * we only have `pullFromOllama`, but the design accepts future MLX/
 * HuggingFace adapters.
 */

import { EventEmitter } from 'events'
import { pullFromOllama } from './ollama-pull.js'
import type {
  AdapterEvent,
  AggregateState,
  DownloadEvent,
  DownloadRequest,
  DownloadSummary,
  EngineSnapshot,
  LayerProgress,
  TaskPhase,
  TaskState,
} from './events.js'

export interface DownloadEngineOptions {
  ollamaHost?: string
  concurrency?: number
  maxAttempts?: number
  retryBaseMs?: number
  /** Min ms between two task-progress emissions for the same task. */
  progressIntervalMs?: number
  /** Inject a custom adapter (for tests). */
  adapter?: AdapterFactory
  fetchFn?: typeof fetch
  now?: () => number
}

export type AdapterFactory = (opts: {
  host: string
  model: string
  signal: AbortSignal
  fetchFn?: typeof fetch
}) => AsyncIterable<AdapterEvent>

export interface DownloadEngine {
  start(requests: DownloadRequest[]): Promise<DownloadSummary>
  cancel(): void
  snapshot(): EngineSnapshot
  on<E extends DownloadEvent['type']>(
    type: E,
    cb: (ev: Extract<DownloadEvent, { type: E }>) => void
  ): () => void
  onAny(cb: (ev: DownloadEvent) => void): () => void
}

const DEFAULT_CONCURRENCY = 2
const MAX_CONCURRENCY = 4
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_BASE_MS = 1000
const DEFAULT_PROGRESS_INTERVAL_MS = 250 // 4Hz per task

export function createDownloadEngine(opts: DownloadEngineOptions = {}): DownloadEngine {
  const host = opts.ollamaHost ?? process.env['OLLAMA_HOST'] ?? 'localhost:11434'
  const concurrency = clamp(
    opts.concurrency ?? DEFAULT_CONCURRENCY,
    1,
    MAX_CONCURRENCY
  )
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const retryBaseMs = opts.retryBaseMs ?? DEFAULT_RETRY_BASE_MS
  const progressIntervalMs = opts.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_MS
  const now = opts.now ?? Date.now
  const adapter: AdapterFactory =
    opts.adapter ??
    (a => pullFromOllama({ host: a.host, model: a.model, signal: a.signal, fetchFn: a.fetchFn ?? opts.fetchFn }))

  const tasks: Record<string, TaskState> = {}
  const lastProgressEmit: Record<string, number> = {}
  // Rolling-window speed samples per task: array of [ts, bytesCompleted].
  const speedSamples: Record<string, Array<[number, number]>> = {}
  const emitter = new EventEmitter()
  let masterAborter = new AbortController()
  let inFlight = 0
  let startedAt = 0

  function snapshot(): EngineSnapshot {
    return {
      tasks: { ...tasks },
      aggregate: computeAggregate(tasks, startedAt),
    }
  }

  function emit(ev: DownloadEvent): void {
    emitter.emit(ev.type, ev)
    emitter.emit('*', ev)
  }

  function setPhase(task: TaskState, next: TaskPhase): void {
    if (task.phase === next) return
    const from = task.phase
    task.phase = next
    if (next === 'done' || next === 'failed' || next === 'canceled') {
      task.endedAt = now()
    }
    emit({ type: 'task-phase', task, from, to: next })
  }

  function maybeEmitProgress(task: TaskState): void {
    const t = now()
    const last = lastProgressEmit[task.modelName] ?? 0
    if (t - last < progressIntervalMs && task.phase !== 'done' && task.phase !== 'failed' && task.phase !== 'canceled') {
      return
    }
    lastProgressEmit[task.modelName] = t
    emit({ type: 'task-progress', task: { ...task } })
  }

  function recordSpeed(task: TaskState): void {
    const t = now()
    const samples = speedSamples[task.modelName] ?? []
    samples.push([t, task.completedBytes])
    // Drop samples older than 10s.
    const cutoff = t - 10_000
    while (samples.length > 0 && samples[0]![0] < cutoff) samples.shift()
    speedSamples[task.modelName] = samples
    if (samples.length >= 2) {
      const first = samples[0]!
      const last = samples[samples.length - 1]!
      const dt = (last[0] - first[0]) / 1000
      const db = last[1] - first[1]
      task.bytesPerSec = dt > 0 ? Math.max(0, db / dt) : 0
    }
    if (task.bytesPerSec > 0 && task.totalBytes > 0) {
      task.etaSeconds = Math.round((task.totalBytes - task.completedBytes) / task.bytesPerSec)
    } else {
      task.etaSeconds = -1
    }
  }

  function applyAdapterEvent(task: TaskState, ev: AdapterEvent): boolean {
    // Returns true on terminal event (done/error).
    switch (ev.type) {
      case 'phase': {
        const map: Record<'manifest' | 'downloading' | 'verifying' | 'writing', TaskPhase> = {
          manifest: 'manifest',
          downloading: 'downloading',
          verifying: 'verifying',
          writing: 'writing',
        }
        setPhase(task, map[ev.phase])
        maybeEmitProgress(task)
        return false
      }
      case 'layer-progress': {
        task.layers[ev.digest] = {
          digest: ev.digest,
          total: ev.total,
          completed: ev.completed,
        } satisfies LayerProgress
        recomputeAggregateBytes(task)
        recordSpeed(task)
        task.lastStatusLine = `pulling ${ev.digest.slice(0, 8)}… ${humanPct(task.percent)}`
        maybeEmitProgress(task)
        return false
      }
      case 'log': {
        if (ev.line) task.lastStatusLine = ev.line
        emit({ type: 'log', modelName: task.modelName, line: ev.line })
        return false
      }
      case 'done': {
        // Force percent to 100 at the end, even if our layer total was off.
        task.percent = 100
        task.completedBytes = task.totalBytes || task.completedBytes
        setPhase(task, 'done')
        maybeEmitProgress(task)
        return true
      }
      case 'error': {
        task.errorMessage = ev.error
        return true
      }
      default: {
        const _exhaustive: never = ev
        void _exhaustive
        return false
      }
    }
  }

  function recomputeAggregateBytes(task: TaskState): void {
    let total = 0
    let completed = 0
    for (const layer of Object.values(task.layers)) {
      total += layer.total
      completed += layer.completed
    }
    task.totalBytes = total
    task.completedBytes = completed
    if (total > 0) {
      task.percent = Math.max(0, Math.min(100, (completed / total) * 100))
    } else {
      task.percent = -1
    }
  }

  async function runOneTask(req: DownloadRequest): Promise<{ ok: boolean; error?: string }> {
    const task = tasks[req.modelName]!
    let attempt = 0
    let lastError: { message: string; retriable: boolean } | null = null

    while (attempt < maxAttempts) {
      attempt += 1
      task.attempt = attempt
      setPhase(task, 'starting')
      emit({ type: 'task-started', task: { ...task } })

      const childAborter = new AbortController()
      const onMasterAbort = () => childAborter.abort()
      masterAborter.signal.addEventListener('abort', onMasterAbort, { once: true })

      try {
        const iter = adapter({
          host,
          model: req.modelName,
          signal: childAborter.signal,
          fetchFn: opts.fetchFn,
        })
        let terminal: 'done' | 'error' | null = null
        for await (const ev of iter) {
          if (masterAborter.signal.aborted) break
          const isTerm = applyAdapterEvent(task, ev)
          if (isTerm) {
            if (ev.type === 'done') terminal = 'done'
            else if (ev.type === 'error') terminal = 'error'
            break
          }
        }

        if (masterAborter.signal.aborted) {
          setPhase(task, 'canceled')
          emit({ type: 'task-canceled', task: { ...task } })
          return { ok: false, error: 'canceled' }
        }

        if (terminal === 'done') {
          emit({ type: 'task-done', task: { ...task } })
          return { ok: true }
        }

        // Either an explicit error event or the stream ended unexpectedly.
        lastError = {
          message: task.errorMessage ?? 'unknown error',
          retriable: classifyTaskError(task.errorMessage),
        }
      } catch (err) {
        lastError = {
          message: err instanceof Error ? err.message : String(err),
          retriable: true,
        }
      } finally {
        masterAborter.signal.removeEventListener('abort', onMasterAbort)
      }

      if (!lastError.retriable || attempt >= maxAttempts) {
        break
      }

      // Schedule retry.
      const delayMs = retryBaseMs * Math.pow(3, attempt - 1)
      setPhase(task, 'retrying')
      emit({ type: 'task-retrying', task: { ...task }, delayMs })
      const aborted = await sleep(delayMs, masterAborter.signal)
      if (aborted) {
        setPhase(task, 'canceled')
        emit({ type: 'task-canceled', task: { ...task } })
        return { ok: false, error: 'canceled' }
      }
    }

    task.errorMessage = lastError?.message ?? 'failed'
    setPhase(task, 'failed')
    emit({ type: 'task-failed', task: { ...task }, error: task.errorMessage })
    return { ok: false, error: task.errorMessage }
  }

  async function start(requests: DownloadRequest[]): Promise<DownloadSummary> {
    masterAborter = new AbortController()
    startedAt = now()
    const succeeded: string[] = []
    const failed: Array<{ name: string; error: string }> = []
    const canceled: string[] = []

    for (const req of requests) {
      const t = makeTask(req, maxAttempts, now())
      tasks[req.modelName] = t
      emit({ type: 'task-queued', task: { ...t } })
    }

    const queue = requests.slice()
    const workers: Promise<void>[] = []

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        if (masterAborter.signal.aborted) return
        const next = queue.shift()
        if (!next) return
        inFlight += 1
        try {
          const result = await runOneTask(next)
          if (result.ok) succeeded.push(next.modelName)
          else if (result.error === 'canceled') canceled.push(next.modelName)
          else failed.push({ name: next.modelName, error: result.error ?? 'unknown' })
        } finally {
          inFlight -= 1
        }
      }
    }

    for (let i = 0; i < concurrency; i++) workers.push(worker())
    await Promise.all(workers)

    // Mark anything still queued as canceled (only happens if cancel fired
    // before workers picked them up).
    for (const name of Object.keys(tasks)) {
      const t = tasks[name]!
      if (t.phase === 'queued') {
        setPhase(t, 'canceled')
        emit({ type: 'task-canceled', task: { ...t } })
        canceled.push(name)
      }
    }

    const summary: DownloadSummary = {
      succeeded,
      failed,
      canceled,
      durationMs: now() - startedAt,
    }
    if (masterAborter.signal.aborted) {
      emit({ type: 'engine-canceled' })
    }
    emit({ type: 'engine-done', summary })
    return summary
  }

  function cancel(): void {
    masterAborter.abort()
  }

  function on<E extends DownloadEvent['type']>(
    type: E,
    cb: (ev: Extract<DownloadEvent, { type: E }>) => void
  ): () => void {
    const wrapped = (ev: unknown) => cb(ev as Extract<DownloadEvent, { type: E }>)
    emitter.on(type, wrapped)
    return () => emitter.off(type, wrapped)
  }

  function onAny(cb: (ev: DownloadEvent) => void): () => void {
    const wrapped = (ev: unknown) => cb(ev as DownloadEvent)
    emitter.on('*', wrapped)
    return () => emitter.off('*', wrapped)
  }

  return { start, cancel, snapshot, on, onAny }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTask(req: DownloadRequest, maxAttempts: number, ts: number): TaskState {
  return {
    modelName: req.modelName,
    provider: req.provider,
    phase: 'queued',
    layers: {},
    totalBytes: 0,
    completedBytes: 0,
    percent: -1,
    bytesPerSec: 0,
    etaSeconds: -1,
    attempt: 0,
    maxAttempts,
    lastStatusLine: 'queued',
    startedAt: ts,
  }
}

function computeAggregate(
  tasks: Record<string, TaskState>,
  startedAt: number
): AggregateState {
  const list = Object.values(tasks)
  const done = list.filter(t => t.phase === 'done').length
  const failed = list.filter(t => t.phase === 'failed').length
  const queued = list.filter(t => t.phase === 'queued').length
  const inFlight = list.filter(
    t =>
      t.phase === 'starting' ||
      t.phase === 'manifest' ||
      t.phase === 'downloading' ||
      t.phase === 'verifying' ||
      t.phase === 'writing' ||
      t.phase === 'retrying'
  ).length
  // Average percent across tasks; -1 (indeterminate) counts as 0.
  const sum = list.reduce((acc, t) => acc + (t.percent < 0 ? 0 : t.percent), 0)
  const overall = list.length > 0 ? sum / list.length : 0
  return {
    totalTasks: list.length,
    doneTasks: done,
    failedTasks: failed,
    inFlightTasks: inFlight,
    queuedTasks: queued,
    overallPercent: overall,
    startedAt,
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function humanPct(p: number): string {
  if (p < 0) return '…'
  return p.toFixed(0) + '%'
}

function classifyTaskError(message: string | undefined): boolean {
  if (!message) return true
  if (/file does not exist/i.test(message)) return false
  if (/no space left/i.test(message)) return false
  if (/unauthorized|forbidden/i.test(message)) return false
  return true
}

function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve(true)
      return
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve(false)
    }, ms)
    const onAbort = () => {
      cleanup()
      resolve(true)
    }
    signal.addEventListener('abort', onAbort)
    function cleanup() {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    }
  })
}
