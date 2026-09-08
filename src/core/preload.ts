import type { ModelConfig } from '../types/index.js'
import { callModel, streamFirstToken } from '../providers/compat.js'
import chalk from 'chalk'

export interface PreloadResult {
  model: string
  success: boolean
  /** Total elapsed for the preload call (ms). */
  duration: number
  /**
   * Milliseconds until the first token came back over the stream. The
   * meaningful "warm" signal — `duration` includes stream teardown which
   * adds noise. -1 if no token was received (failure or non-streaming
   * fallback).
   */
  firstTokenMs?: number
  error?: string
}

/**
 * Check if a model needs pre-loading. Only Ollama models do — cloud providers
 * and MLX server endpoints don't have a "warmup" notion in the same sense
 * (their first call latency is dominated by network / startup, not weight
 * loading).
 */
export function needsPreload(model: ModelConfig): boolean {
  return model.provider === 'ollama'
}

/**
 * Pre-load a single model. Prefers streaming "first token" detection
 * because that's the actual signal of "weights are warm" — total response
 * latency adds tokenize-prompt + decode + network teardown noise on top.
 *
 * Falls back to a regular blocking call if the streaming request fails
 * (older Ollama versions, non-streaming providers, etc.) so legacy
 * behavior is preserved.
 */
export async function preloadModel(
  model: ModelConfig,
  _verbose: boolean = false
): Promise<PreloadResult> {
  const start = Date.now()
  const stream = await streamFirstToken(model, '1+1=?')
  if (stream.ok) {
    return {
      model: model.id,
      success: true,
      duration: stream.totalMs,
      firstTokenMs: stream.firstTokenMs,
    }
  }

  // Streaming path failed — try the non-streaming call. If THAT succeeds
  // we still consider the preload OK (the model loaded, just couldn't
  // stream). If both fail, report the streaming error since it's the more
  // informative signal.
  try {
    await callModel(model, '1+1=?')
    return {
      model: model.id,
      success: true,
      duration: Date.now() - start,
    }
  } catch (err) {
    return {
      model: model.id,
      success: false,
      duration: Date.now() - start,
      error: stream.error ?? (err instanceof Error ? err.message : String(err)),
    }
  }
}

export interface PreloadOptions {
  /**
   * Max concurrent preload requests. Default 2 — Ollama can serve two warmup
   * loads in parallel on a 24 GB machine without OOM. Beyond 2 the aggregate
   * throughput regresses on most macOS configurations because Ollama
   * serializes weight loading internally.
   */
  concurrency?: number
  /** Inject a clock for deterministic tests. */
  now?: () => number
  /** Optional per-model progress callback (start / end). */
  onProgress?: (event: PreloadProgressEvent) => void
}

export type PreloadProgressEvent =
  | { type: 'start'; model: string }
  | { type: 'done'; result: PreloadResult }

/**
 * Indicators that an error is memory-pressure-related rather than transient.
 * If we see this, future preloads in the same run drop to serial loading so
 * we don't exacerbate the problem. Patterns kept loose because Ollama wraps
 * OOMs in several different message shapes across versions.
 */
const OOM_PATTERNS = [
  /out of memory/i,
  /\boom\b/i,
  /unable to allocate/i,
  /no space/i,
  /kvc/i,
  /memory pressure/i,
]

function isOomLike(message: string | undefined): boolean {
  if (!message) return false
  return OOM_PATTERNS.some(p => p.test(message))
}

/**
 * Pre-load all models that need it, in parallel up to `concurrency`.
 *
 * If we detect an OOM-like error during the run, subsequent models load
 * sequentially — better a slow finish than a cascading crash. The first
 * detected OOM still counts as a failure for its task but doesn't abort
 * remaining loads; the runner downstream can still attempt those models.
 *
 * Failures with patterns that signal critical misconfig (model missing,
 * daemon down) still cause `process.exit(1)` — same as the prior behavior.
 */
export async function preloadModels(
  models: ModelConfig[],
  opts: boolean | PreloadOptions = false
): Promise<PreloadResult[]> {
  // Back-compat shim: callers used to pass `verbose: boolean` here. Map
  // the legacy second arg to PreloadOptions with the default concurrency.
  const options: PreloadOptions = typeof opts === 'boolean' ? {} : opts

  const modelsToLoad = models.filter(needsPreload)
  if (modelsToLoad.length === 0) return []

  console.log()
  console.log(chalk.bold('Pre-loading models...'))

  const concurrency = Math.max(1, Math.min(modelsToLoad.length, options.concurrency ?? 2))
  const wallStart = Date.now()
  const results: PreloadResult[] = []
  const queue = [...modelsToLoad]
  let oomDetected = false
  // Tracks loads currently running. After OOM is detected we use this to
  // enforce a strict barrier: no new load starts until peers finish theirs.
  const inFlight: Set<Promise<unknown>> = new Set()
  // Tracks start times for the live elapsed-time ticker.
  const inFlightStarts = new Map<string, number>()

  // Live ticker — only when stdout is a TTY. Updates a single line at the
  // bottom of the preload section with "model (Xs)" for each in-flight
  // model, refreshed every second. On CI / non-TTY environments we skip
  // the ticker; the per-model done/fail lines still print.
  const isTty = !!process.stdout.isTTY && !process.env['CI']
  let tickerLineActive = false
  function eraseTicker(): void {
    if (!tickerLineActive) return
    process.stdout.write('\x1b[2K\r')
    tickerLineActive = false
  }
  function renderTicker(): void {
    if (!isTty) return
    if (inFlightStarts.size === 0) {
      eraseTicker()
      return
    }
    const parts: string[] = []
    for (const [model, started] of inFlightStarts) {
      const sec = ((Date.now() - started) / 1000).toFixed(0)
      parts.push(`${model} (${sec}s)`)
    }
    eraseTicker()
    process.stdout.write(chalk.dim('  warming: ' + parts.join(', ')))
    tickerLineActive = true
  }
  const ticker = isTty ? setInterval(renderTicker, 1000) : null

  function emit(line: string): void {
    eraseTicker()
    console.log(line)
    renderTicker()
  }

  async function processSlot(): Promise<void> {
    while (queue.length > 0) {
      // Once OOM is observed, drain serially: wait for every other slot's
      // current load to finish before claiming the next task. The slot
      // that detected the OOM keeps making forward progress; peers are
      // gated through this barrier.
      if (oomDetected && inFlight.size > 0) {
        await Promise.all([...inFlight])
      }

      const next = queue.shift()
      if (!next) return

      options.onProgress?.({ type: 'start', model: next.id })
      inFlightStarts.set(next.id, Date.now())
      renderTicker()
      const work = preloadModel(next)
      inFlight.add(work)
      let result: PreloadResult
      try {
        result = await work
      } finally {
        inFlight.delete(work)
        inFlightStarts.delete(next.id)
      }
      results.push(result)
      options.onProgress?.({ type: 'done', result })

      if (result.success) {
        const timeStr = (result.duration / 1000).toFixed(1) + 's'
        const ftt = result.firstTokenMs !== undefined && result.firstTokenMs >= 0
          ? chalk.dim(` — first token at ${(result.firstTokenMs / 1000).toFixed(1)}s`)
          : ''
        emit(chalk.green('  ✓') + ' ' + next.id + chalk.dim(` (${timeStr})`) + ftt)
      } else {
        emit(chalk.red('  ✗') + ' ' + next.id + chalk.dim(` - ${result.error}`))
        if (isOomLike(result.error) && !oomDetected) {
          oomDetected = true
          emit(chalk.yellow('  ⚠  memory pressure detected — remaining models load sequentially'))
        }
      }
    }
  }

  const slots: Promise<void>[] = []
  for (let i = 0; i < concurrency; i++) {
    slots.push(processSlot())
  }
  try {
    await Promise.all(slots)
  } finally {
    if (ticker) clearInterval(ticker)
    eraseTicker()
  }

  // Summary.
  const successful = results.filter(r => r.success).length
  const totalWallTime = (Date.now() - wallStart) / 1000
  const cpuTime = results.reduce((sum, r) => sum + r.duration, 0) / 1000

  console.log()
  if (successful === results.length) {
    // Show both wall time (what the user waited) and CPU time (sum of all
    // loads) so the parallelism speedup is visible.
    const savings = cpuTime > totalWallTime
      ? chalk.dim(` (${(cpuTime - totalWallTime).toFixed(1)}s saved by parallelism)`)
      : ''
    console.log(
      chalk.green('All models ready') +
      chalk.dim(` (${totalWallTime.toFixed(1)}s wall, ${cpuTime.toFixed(1)}s cumulative${savings})`)
    )
  } else {
    const failed = results.length - successful
    console.log(chalk.yellow(`${successful}/${results.length} models ready`) + chalk.dim(` (${failed} failed)`))

    // Hard-failure patterns abort the run rather than continue with a
    // half-broken setup. Mirrors prior behavior.
    const criticalErrors = results.filter(r => !r.success && (
      r.error?.includes('not found') ||
      r.error?.includes('not installed') ||
      r.error?.includes('ECONNREFUSED')
    ))

    if (criticalErrors.length > 0) {
      console.log()
      console.log(chalk.red('Critical errors:'))
      for (const err of criticalErrors) {
        console.log(chalk.red('  •'), err.model + ':', err.error)
      }
      console.log()
      console.log(chalk.yellow('Fix these issues before running evals.'))
      console.log()
      process.exit(1)
    }
  }

  console.log()
  return results
}

/**
 * Async variant: kick off the preload pool and return a map of per-model
 * promises. The pool still honors `concurrency`, so at most N models warm
 * at once even if callers await all of them concurrently. Used by the
 * runner to start cases on fast-warming models while slower models are
 * still loading (B3).
 *
 * Models that don't need preload (cloud / MLX) resolve immediately to a
 * success result with duration=0, so callers can `await` uniformly.
 */
export function preloadModelsAsync(
  models: ModelConfig[],
  options: PreloadOptions = {}
): Map<string, Promise<PreloadResult>> {
  const futures = new Map<string, Promise<PreloadResult>>()
  // Models that skip preload resolve immediately so case loops can await
  // uniformly without branching on provider.
  const skipped: ModelConfig[] = []
  const loadable: ModelConfig[] = []
  for (const m of models) {
    if (needsPreload(m)) loadable.push(m)
    else {
      skipped.push(m)
      futures.set(m.id, Promise.resolve({
        model: m.id, success: true, duration: 0,
      }))
    }
  }
  if (loadable.length === 0) return futures

  // Each loadable model gets a deferred resolver wired up here. The pool
  // workers below pull from the queue, load, and resolve the deferred.
  type Deferred = { resolve: (r: PreloadResult) => void }
  const resolvers = new Map<string, Deferred>()
  for (const m of loadable) {
    futures.set(
      m.id,
      new Promise<PreloadResult>(resolve => {
        resolvers.set(m.id, { resolve })
      })
    )
  }

  const concurrency = Math.max(1, Math.min(loadable.length, options.concurrency ?? 2))
  const queue = [...loadable]
  let oomDetected = false
  const inFlight: Set<Promise<unknown>> = new Set()

  async function processSlot(): Promise<void> {
    while (queue.length > 0) {
      if (oomDetected && inFlight.size > 0) {
        await Promise.all([...inFlight])
      }
      const next = queue.shift()
      if (!next) return
      options.onProgress?.({ type: 'start', model: next.id })
      const work = preloadModel(next)
      inFlight.add(work)
      let result: PreloadResult
      try {
        result = await work
      } finally {
        inFlight.delete(work)
      }
      options.onProgress?.({ type: 'done', result })
      resolvers.get(next.id)?.resolve(result)
      if (!result.success && isOomLike(result.error)) {
        oomDetected = true
      }
    }
  }

  // Kick off the pool. The futures map is returned synchronously so
  // callers can start awaiting per-model promises before any load has
  // finished.
  const slots: Promise<void>[] = []
  for (let i = 0; i < concurrency; i++) {
    slots.push(processSlot())
  }
  // Catch any unhandled rejection at the slot level — individual model
  // failures are already wrapped in PreloadResult and don't reject.
  Promise.all(slots).catch(() => undefined)

  return futures
}
