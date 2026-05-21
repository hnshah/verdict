/**
 * Non-TUI renderers for the onboarding flow. Two output modes:
 *   - Periodic one-line summary (default for non-TTY).
 *   - NDJSON of every event (`--json`).
 *
 * Both subscribe to an OnboardingController; they don't own the engine.
 */

import chalk from 'chalk'
import type {
  OnboardingController,
  OnboardingLog,
  OnboardingState,
} from '../index.js'

export interface HeadlessOptions {
  /** Write to stdout (default `process.stdout`). */
  out?: NodeJS.WritableStream
  /** Periodic status interval in ms. Default 5000. */
  statusIntervalMs?: number
  /** Color output. Defaults to true if stdout is a TTY. */
  color?: boolean
}

/**
 * Attach the periodic one-line status renderer. Returns an unsubscribe fn.
 */
export function attachPeriodicHeadless(
  controller: OnboardingController,
  opts: HeadlessOptions = {}
): () => void {
  const out = opts.out ?? process.stdout
  const intervalMs = opts.statusIntervalMs ?? 5000
  const color = opts.color ?? !!process.stdout.isTTY

  const write = (msg: string) => out.write(msg.endsWith('\n') ? msg : msg + '\n')
  const dim = (s: string) => (color ? chalk.dim(s) : s)
  const green = (s: string) => (color ? chalk.green(s) : s)
  const red = (s: string) => (color ? chalk.red(s) : s)
  const yellow = (s: string) => (color ? chalk.yellow(s) : s)

  const unsubState = controller.on('state', (s: OnboardingState) => {
    write(stateSummary(s, { green, red, yellow, dim }))
  })
  const unsubLog = controller.on('log', (l: OnboardingLog) => {
    if (l.level === 'error') write(red(`  [${l.source ?? 'log'}] ${l.msg}`))
    else if (l.level === 'warn') write(yellow(`  [${l.source ?? 'log'}] ${l.msg}`))
    else write(dim(`  [${l.source ?? 'log'}] ${l.msg}`))
  })

  // Periodic progress tick during pull state.
  const ticker = setInterval(() => {
    const state = controller.getState()
    if (state.kind === 'pull') {
      const total = state.aggregate.totalTasks
      const done = state.aggregate.doneTasks
      const overall = state.aggregate.overallPercent.toFixed(0)
      write(dim(`  pull: ${done}/${total} done, ${overall}% overall`))
      for (const t of Object.values(state.tasks)) {
        write(
          dim(
            `    ${t.modelName.padEnd(28)} ${t.phase.padEnd(12)} ${humanPct(t.percent)} ${humanRate(t.bytesPerSec)} eta=${humanEta(t.etaSeconds)}`
          )
        )
      }
    }
  }, intervalMs)

  return () => {
    clearInterval(ticker)
    unsubState()
    unsubLog()
  }
}

/**
 * Attach the NDJSON renderer. Each event is one JSON line on stdout; logs go
 * to stderr.
 */
export function attachJsonHeadless(controller: OnboardingController): () => void {
  const unsubState = controller.on('state', (s: OnboardingState) => {
    process.stdout.write(JSON.stringify({ kind: 'state', state: s }) + '\n')
  })
  const unsubLog = controller.on('log', (l: OnboardingLog) => {
    process.stderr.write(JSON.stringify({ kind: 'log', log: l }) + '\n')
  })
  return () => {
    unsubState()
    unsubLog()
  }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

interface ColorFns {
  green: (s: string) => string
  red: (s: string) => string
  yellow: (s: string) => string
  dim: (s: string) => string
}

function stateSummary(state: OnboardingState, c: ColorFns): string {
  switch (state.kind) {
    case 'welcome':
      return c.dim('• welcome')
    case 'detect': {
      const inFlight = Object.entries(state.progress)
        .filter(([, v]) => v === 'running')
        .map(([k]) => k)
      return c.dim(`• detect: ${inFlight.length ? inFlight.join(', ') : 'starting'}`)
    }
    case 'plan':
      return c.green(`• plan: ${state.plan.intent} (${state.plan.modelsToPull.length} models to pull, ${state.plan.estimatedDownloadGB.toFixed(1)} GB)`)
    case 'consent':
      return c.dim(`• consent: awaiting user`)
    case 'install': {
      if (state.steps.length === 0) return c.dim('• install: nothing to do')
      const idx = state.currentStep
      const step = state.steps[idx]
      return c.dim(`• install step ${idx + 1}/${state.steps.length}: ${step?.step.label ?? '?'} [${step?.state ?? '?'}]`)
    }
    case 'pull':
      if (state.aggregate.totalTasks === 0) return c.dim('• pull: nothing to pull')
      return c.dim(
        `• pull: ${state.aggregate.doneTasks}/${state.aggregate.totalTasks} done, ${state.aggregate.overallPercent.toFixed(0)}% overall`
      )
    case 'configure':
      return c.dim(`• configure: ${state.action}${state.hasExisting ? ' (existing file)' : ''}`)
    case 'verify':
      return state.result
        ? state.result.ok
          ? c.green(`• verify: ok (score ${state.result.exampleScore.toFixed(1)})`)
          : c.red(`• verify: failed (${state.result.failures.map(f => f.step).join(',')})`)
        : c.dim('• verify: running…')
    case 'done':
      return c.green(`• done — pulled ${state.summary.pulledModels.length} model(s) to ${state.summary.configPath}`)
    case 'cancelled':
      return c.yellow(`• cancelled (from ${state.from})${state.reason ? ': ' + state.reason : ''}`)
    case 'failed':
      return c.red(`• failed at ${state.from}: ${state.error}`)
    default:
      return c.dim('• ?')
  }
}

function humanPct(p: number): string {
  if (p < 0) return ' --%'
  return p.toFixed(0).padStart(3) + '%'
}

function humanRate(bps: number): string {
  if (bps <= 0) return '         '
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 ** 2) return `${(bps / 1024).toFixed(1)} KB/s`
  if (bps < 1024 ** 3) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`
  return `${(bps / 1024 ** 3).toFixed(1)} GB/s`
}

function humanEta(s: number): string {
  if (s < 0) return '   -- '
  if (s < 60) return `${s}s`
  return `${Math.round(s / 60)}m`
}
