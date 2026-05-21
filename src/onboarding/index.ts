/**
 * Onboarding engine — the orchestrator that wires the pure reducer
 * (`state-machine.ts`) to side-effectful work (detect, install, pull,
 * configure, verify) and exposes a typed controller for the TUI / CLI to
 * subscribe to.
 *
 * Design rules:
 *  - The reducer remains pure; side effects live here.
 *  - Side effects emit `__` events that get fed back into `send()`.
 *  - State transitions persist a mark file (`~/.verdict/onboarding.json`).
 *  - One AbortController per side effect; cancel() aborts all of them.
 *  - Same engine is used for TUI and headless modes.
 */

import { EventEmitter } from 'events'
import os from 'os'
import path from 'path'

import {
  initialState,
  initialDetectProgress,
  reduce,
} from './state-machine.js'
import { detect } from './detect.js'
import { propose } from './planner.js'
import {
  commitConfigWrite,
  planConfigWrite,
} from './config-writer.js'
import {
  installOllama,
  killStartedOllama,
  startOllamaDaemon,
  writeCloudKey,
} from './install/ollama.js'
import { runSmokeEval } from './verify.js'
import {
  isMarkStale,
  readMark,
  writeMark,
} from './persistence.js'
import { createDownloadEngine } from './download/engine.js'
import type {
  DownloadEvent,
  EngineSnapshot as DownloadSnapshot,
} from './download/events.js'
import type {
  DetectProgress,
  OnboardingEvent,
  OnboardingLog,
  OnboardingMark,
  OnboardingState,
  Plan,
  PullAggregateView,
  PullTaskView,
  Snapshot,
} from './events.js'

// ─── Public surface ─────────────────────────────────────────────────────────

export interface OnboardingController {
  send(event: OnboardingEvent): void
  getState(): OnboardingState
  /** Subscribe to state changes. Returns an unsubscribe fn. */
  on(event: 'state', cb: (s: OnboardingState) => void): () => void
  on(event: 'log', cb: (l: OnboardingLog) => void): () => void
  on(event: 'done', cb: () => void): () => void
  on(event: 'cancel', cb: () => void): () => void
  /** Cancel all in-flight work and persist mark. */
  cancel(reason?: string): void
  dispose(): void
  /** Wait for the engine to reach a terminal state (done/cancelled/failed). */
  waitForTerminal(): Promise<OnboardingState>
}

export interface StartOnboardingOptions {
  configPath?: string
  catalogPath?: string
  ollamaHost?: string
  /** Auto-resume from a stale-but-recent mark file. */
  resume?: boolean
  /** Ignore prior mark file even if status=completed/skipped. */
  force?: boolean
  /** Stop after detect (debug). */
  detectOnly?: boolean
}

// ─── Implementation ─────────────────────────────────────────────────────────

interface InternalState {
  state: OnboardingState
  snapshot?: Snapshot
  plan?: Plan
  startedAt: number
  pulledModels: string[]
  // Track the side effects we own per state so we can cancel cleanly.
  aborts: AbortController[]
  // Path where the current configure step will write.
  finalConfigPath?: string
  configBackupPath?: string
}

export function startOnboarding(opts: StartOnboardingOptions = {}): OnboardingController {
  const configPath = opts.configPath ?? './verdict.yaml'
  const ollamaHost = opts.ollamaHost ?? process.env['OLLAMA_HOST'] ?? 'localhost:11434'

  const emitter = new EventEmitter()
  const internal: InternalState = {
    state: initialState(),
    startedAt: Date.now(),
    pulledModels: [],
    aborts: [],
  }
  let terminalResolver: ((s: OnboardingState) => void) | null = null
  const terminalPromise = new Promise<OnboardingState>(resolve => {
    terminalResolver = resolve
  })

  // Initialize: maybe resume from a mark file.
  const existing = readMark()
  if (existing && !opts.force) {
    if (existing.status === 'in-progress' && !isMarkStale(existing) && opts.resume) {
      internal.snapshot = existing.snapshot
      internal.plan = existing.plan
      internal.pulledModels = existing.pulledModels
      // Resume in welcome (engine will advance based on lastCompletedState).
    }
  }

  function emitState(): void {
    emitter.emit('state', internal.state)
  }
  function emitLog(level: OnboardingLog['level'], msg: string, source?: string): void {
    const log: OnboardingLog = { ts: Date.now(), level, msg, source }
    emitter.emit('log', log)
  }

  function persistMark(status: OnboardingMark['status'] = 'in-progress'): void {
    // Only persist progress-bearing states; cancelled/failed don't need a
    // resume target.
    const lastCompletedState: OnboardingMark['lastCompletedState'] =
      internal.state.kind === 'welcome' ||
      internal.state.kind === 'cancelled' ||
      internal.state.kind === 'failed'
        ? undefined
        : internal.state.kind
    const mark: OnboardingMark = {
      version: 1,
      status,
      startedAt: new Date(internal.startedAt).toISOString(),
      completedAt:
        status === 'completed' || status === 'cancelled' ? new Date().toISOString() : undefined,
      lastCompletedState,
      snapshot: internal.snapshot,
      plan: internal.plan,
      pulledModels: internal.pulledModels,
    }
    try {
      writeMark(mark)
    } catch (err) {
      emitLog('warn', `Failed to write mark file: ${err instanceof Error ? err.message : err}`)
    }
  }

  function addAbort(): AbortController {
    const ac = new AbortController()
    internal.aborts.push(ac)
    return ac
  }

  function cancelAllAborts(): void {
    for (const ac of internal.aborts) {
      try { ac.abort() } catch { /* noop */ }
    }
    internal.aborts = []
  }

  function dispatch(event: OnboardingEvent): void {
    const prev = internal.state
    const next = reduce(prev, event)
    if (next === prev) {
      // No-op event — nothing to do.
      return
    }
    internal.state = next
    persistMark(
      next.kind === 'done'
        ? 'completed'
        : next.kind === 'cancelled'
          ? 'cancelled'
          : 'in-progress'
    )
    emitState()
    if (prev.kind !== next.kind) {
      onEnter(prev.kind, next)
    }
  }

  /** Side-effect dispatcher: when the FSM enters a new state, kick off work. */
  function onEnter(prevKind: OnboardingState['kind'], state: OnboardingState): void {
    switch (state.kind) {
      case 'detect': {
        void runDetectStep()
        break
      }
      case 'install': {
        void runInstallStep(state.plan)
        break
      }
      case 'pull': {
        void runPullStep(state.plan)
        break
      }
      case 'configure': {
        // If we just got here from pull, render the YAML and emit ready.
        if (prevKind === 'pull') void runConfigureStep(internal.plan!)
        break
      }
      case 'verify': {
        void runVerifyStep()
        break
      }
      case 'done':
      case 'cancelled':
      case 'failed': {
        cancelAllAborts()
        if (state.kind === 'cancelled') killStartedOllama()
        if (terminalResolver) {
          terminalResolver(state)
          terminalResolver = null
        }
        if (state.kind === 'done') emitter.emit('done')
        if (state.kind === 'cancelled') emitter.emit('cancel')
        break
      }
      default:
        break
    }
  }

  // ─── Side-effect steps ────────────────────────────────────────────────────

  async function runDetectStep(): Promise<void> {
    const ac = addAbort()
    try {
      const snapshot = await detect({
        configPath,
        ollamaHost,
        onProgress: (p: DetectProgress) => {
          if (ac.signal.aborted) return
          dispatch({ type: '__detect-progress', data: p })
        },
      })
      if (ac.signal.aborted) return
      internal.snapshot = snapshot
      const plan = safelyPropose(snapshot)
      internal.plan = plan
      if (opts.detectOnly) {
        // For debug — surface plan as a `done` with empty summary so callers
        // can inspect snapshot+plan via getState() before exiting.
        dispatch({ type: '__detect-complete', snapshot, plan })
        return
      }
      dispatch({ type: '__detect-complete', snapshot, plan })
    } catch (err) {
      dispatch({
        type: '__error',
        error: err instanceof Error ? err.message : String(err),
        recoverable: true,
      })
    }
  }

  function safelyPropose(snapshot: Snapshot): Plan {
    try {
      return propose(snapshot, opts.catalogPath ? { catalogPath: opts.catalogPath } : {})
    } catch (err) {
      // Catalog missing or invalid → fall back to a minimum "config-only-ish"
      // plan that asks the user to configure manually. Emit a log so they see
      // why.
      emitLog(
        'warn',
        `Planner failed (${err instanceof Error ? err.message : err}); falling back to detect-only.`
      )
      return {
        intent: 'config-only',
        installSteps: [],
        modelsToPull: [],
        cloudModels: [],
        reuseModels: snapshot.ollama.installedModels,
        judge: { modelId: '', rationale: 'No plan could be produced — review your verdict.yaml.' },
        config: { action: 'leave', targetPath: configPath },
        rationale: 'Planner unavailable.',
        estimatedDownloadGB: 0,
        estimatedDurationMin: [0, 1],
      }
    }
  }

  async function runInstallStep(plan: Plan): Promise<void> {
    const ac = addAbort()
    for (let i = 0; i < plan.installSteps.length; i++) {
      if (ac.signal.aborted) return
      const step = plan.installSteps[i]!
      dispatch({
        type: '__install-step-progress',
        index: i,
        line: '',
        state: 'running',
      })
      try {
        let runner
        if (step.id === 'install-ollama') {
          runner = installOllama({ method: step.method ?? 'brew' })
        } else if (step.id === 'start-ollama') {
          runner = startOllamaDaemon({ host: ollamaHost })
        } else if (step.id === 'capture-cloud-key') {
          // Wait for the consent step to supply the key — engine layer
          // attaches it. For now, no-op.
          continue
        } else if (step.id === 'install-mlx-lm') {
          // V1 doesn't auto-install MLX; user must opt-in via `pip install
          // mlx-lm` themselves. Skip with a log.
          emitLog('info', 'MLX install skipped — run `pip install mlx-lm` manually if needed.')
          dispatch({ type: '__install-step-progress', index: i, line: 'skipped', state: 'done' })
          continue
        }
        if (!runner) continue
        await runner.run({
          onLine: (line: string) => {
            dispatch({
              type: '__install-step-progress',
              index: i,
              line,
              state: 'running',
            })
          },
          signal: ac.signal,
        })
        dispatch({ type: '__install-step-progress', index: i, line: '', state: 'done' })
      } catch (err) {
        dispatch({
          type: '__install-step-failed',
          index: i,
          error: err instanceof Error ? err.message : String(err),
        })
        dispatch({
          type: '__error',
          error: err instanceof Error ? err.message : String(err),
          recoverable: true,
        })
        return
      }
    }
    if (ac.signal.aborted) return
    dispatch({ type: '__install-complete' })
  }

  async function runPullStep(plan: Plan): Promise<void> {
    if (plan.modelsToPull.length === 0) {
      dispatch({ type: '__pull-complete' })
      return
    }
    const ac = addAbort()
    const downloadEngine = createDownloadEngine({ ollamaHost })
    const unsub = downloadEngine.onAny((ev: DownloadEvent) => {
      if (ev.type === 'log') {
        emitLog('info', ev.line, ev.modelName ?? undefined)
        return
      }
      // Map engine snapshot to onboarding's PullTaskView/PullAggregateView.
      const snap: DownloadSnapshot = downloadEngine.snapshot()
      const tasks: Record<string, PullTaskView> = {}
      for (const t of Object.values(snap.tasks)) {
        tasks[t.modelName] = {
          modelName: t.modelName,
          phase: t.phase,
          percent: t.percent,
          bytesPerSec: t.bytesPerSec,
          etaSeconds: t.etaSeconds,
          attempt: t.attempt,
          errorMessage: t.errorMessage,
        }
      }
      const aggregate: PullAggregateView = {
        overallPercent: snap.aggregate.overallPercent,
        doneTasks: snap.aggregate.doneTasks,
        totalTasks: snap.aggregate.totalTasks,
        failedTasks: snap.aggregate.failedTasks,
      }
      dispatch({ type: '__pull-progress', tasks, aggregate })
    })
    ac.signal.addEventListener('abort', () => downloadEngine.cancel(), { once: true })
    try {
      const summary = await downloadEngine.start(
        plan.modelsToPull.map(m => ({ modelName: m.name, provider: 'ollama' as const }))
      )
      internal.pulledModels.push(...summary.succeeded)
      if (ac.signal.aborted) return
      // Even if some pulls failed, continue — verify will surface issues. We
      // only abort the flow if ZERO pulls succeeded AND we needed at least one.
      if (summary.succeeded.length === 0 && plan.modelsToPull.length > 0) {
        dispatch({
          type: '__error',
          error: `All ${plan.modelsToPull.length} pulls failed.`,
          recoverable: true,
        })
        return
      }
      dispatch({ type: '__pull-complete' })
    } catch (err) {
      dispatch({
        type: '__error',
        error: err instanceof Error ? err.message : String(err),
        recoverable: true,
      })
    } finally {
      unsub()
    }
  }

  async function runConfigureStep(plan: Plan): Promise<void> {
    try {
      const wp = planConfigWrite(plan)
      dispatch({
        type: '__configure-ready',
        previewYaml: wp.preview,
        diff: wp.diff,
        hasExisting: wp.hasExisting,
      })
      // Auto-commit using the action the planner chose. Future improvement:
      // wait for an explicit user 'next' here in the UI; for now we proceed.
      const result = commitConfigWrite(plan, wp)
      internal.finalConfigPath = result.finalPath
      internal.configBackupPath = result.backupPath
      emitLog('info', `Wrote ${result.finalPath} (${result.action})`, 'config-writer')
      dispatch({
        type: '__configure-written',
        configPath: result.finalPath,
        backupPath: result.backupPath,
      })
    } catch (err) {
      dispatch({
        type: '__error',
        error: err instanceof Error ? err.message : String(err),
        recoverable: false,
      })
    }
  }

  async function runVerifyStep(): Promise<void> {
    const ac = addAbort()
    void ac // verify doesn't currently honor signal — captured for future use
    try {
      const result = await runSmokeEval({
        configPath: internal.finalConfigPath ?? configPath,
        onProgress: msg => emitLog('info', msg, 'verify'),
      })
      dispatch({ type: '__verify-complete', result })
      // Transition automatically to done.
      const durationMs = Date.now() - internal.startedAt
      internal.state = {
        kind: 'done',
        summary: {
          pulledModels: internal.pulledModels,
          reusedModels: internal.plan?.reuseModels ?? [],
          configPath: internal.finalConfigPath ?? configPath,
          configBackupPath: internal.configBackupPath,
          smokeScore: result.exampleScore,
          totalDurationMs: durationMs,
        },
      }
      persistMark('completed')
      emitState()
      if (terminalResolver) {
        terminalResolver(internal.state)
        terminalResolver = null
      }
      emitter.emit('done')
    } catch (err) {
      dispatch({
        type: '__error',
        error: err instanceof Error ? err.message : String(err),
        recoverable: true,
      })
    }
  }

  // ─── Public methods ──────────────────────────────────────────────────────

  const controller: OnboardingController = {
    send: dispatch,
    getState: () => internal.state,
    on(event: string, cb: (...args: any[]) => void) {
      emitter.on(event, cb)
      return () => emitter.off(event, cb)
    },
    cancel(reason?: string) {
      cancelAllAborts()
      dispatch({ type: 'cancel', reason })
    },
    dispose() {
      cancelAllAborts()
      emitter.removeAllListeners()
    },
    waitForTerminal() {
      return terminalPromise
    },
  }
  // Persist welcome state and emit it once so subscribers see initial.
  persistMark('in-progress')
  // Schedule initial emit asynchronously so callers can subscribe first.
  queueMicrotask(emitState)

  return controller
}

// Re-exports for the CLI and TUI to import from one place.
export { initialState, initialDetectProgress, reduce } from './state-machine.js'
export * from './events.js'
export { detect } from './detect.js'
export { propose } from './planner.js'
export { readMark, writeMark, isMarkStale, deleteMark } from './persistence.js'
export { renderVerdictYamlFromPlan } from './templates.js'
export { planConfigWrite, commitConfigWrite, unifiedDiff } from './config-writer.js'
export { createDownloadEngine } from './download/engine.js'

// Misc helper for first-run dispatch.
export function verdictDir(): string {
  return path.join(os.homedir(), '.verdict')
}
