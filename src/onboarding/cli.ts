/**
 * `verdict onboarding` CLI command. Wraps the engine, picks the right
 * renderer (Ink TUI or headless) based on environment.
 */

import React from 'react'
import { render } from 'ink'
import chalk from 'chalk'
import {
  isMarkStale,
  readMark,
  startOnboarding,
  type OnboardingController,
  type OnboardingState,
} from './index.js'
import {
  attachJsonHeadless,
  attachPeriodicHeadless,
} from './download/headless.js'
import { writeMark } from './persistence.js'
import type { OnboardingMark } from './events.js'
import { Onboarding } from '../tui/screens/Onboarding/index.js'

export interface OnboardingCliOptions {
  headless?: boolean
  json?: boolean
  force?: boolean
  resume?: boolean
  detectOnly?: boolean
  configPath?: string
  catalogPath?: string
  /** Bypass the entire flow; record mark.status='skipped' and exit. */
  skip?: boolean
}

export async function onboardingCommand(opts: OnboardingCliOptions = {}): Promise<number> {
  // 1. Honor explicit skip flag and the env var. We write the mark directly
  // rather than routing through the engine — the engine treats 'skip' as
  // 'done', and we want a distinct 'skipped' status so future first-run
  // dispatchers know not to relaunch.
  if (opts.skip || process.env['VERDICT_SKIP_ONBOARDING'] === '1') {
    const mark: OnboardingMark = {
      version: 1,
      status: 'skipped',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      pulledModels: [],
    }
    writeMark(mark)
    process.stdout.write('verdict onboarding skipped (recorded).\n')
    return 0
  }

  // 2. Existing mark — respect 'completed'/'skipped' unless --force.
  const mark = readMark()
  if (mark && !opts.force) {
    if (mark.status === 'completed') {
      process.stdout.write(
        chalk.dim(
          'Onboarding already completed. Re-run with `verdict onboarding --force` to redo.\n'
        )
      )
      return 0
    }
    if (mark.status === 'skipped') {
      process.stdout.write(
        chalk.dim(
          'Onboarding previously skipped. Re-run with `verdict onboarding --force` to start fresh.\n'
        )
      )
      return 0
    }
    if (mark.status === 'failed') {
      const where = mark.failedFrom ? ` at ${mark.failedFrom}` : ''
      const why = mark.failedError ? `\n  ${mark.failedError}` : ''
      process.stdout.write(
        chalk.yellow(
          `Last onboarding run failed${where}.${why}\n` +
            'Re-run with `verdict onboarding --force` to start fresh or `--resume` to retry.\n'
        )
      )
      return 0
    }
    if (mark.status === 'in-progress' && !isMarkStale(mark) && !opts.resume) {
      process.stdout.write(
        chalk.yellow(
          'An onboarding run is already in progress. Use --resume to continue or --force to restart.\n'
        )
      )
      return 1
    }
  }

  // 3. --detect-only is a debug short-circuit: print the snapshot + plan
  // as a single readable block (or JSON if --json) and exit. The Ink TUI
  // wouldn't have any sub-views to render past detect, so always route
  // through the headless path (A10).
  if (opts.detectOnly) {
    return runDetectOnly(opts)
  }

  // 4. Pick renderer mode. Explicit --headless/--json wins; otherwise prefer
  // the Ink TUI when stdout is a TTY (and we're not in CI).
  const useTui =
    !opts.headless &&
    !opts.json &&
    !!process.stdout.isTTY &&
    !process.env['CI']

  if (useTui) {
    return runInkTui(opts)
  }

  return runHeadless(opts)
}

// ─── Detect-only launcher ──────────────────────────────────────────────────

async function runDetectOnly(opts: OnboardingCliOptions): Promise<number> {
  const controller = startOnboarding({
    configPath: opts.configPath,
    catalogPath: opts.catalogPath,
    detectOnly: true,
  })
  // Auto-advance from welcome → detect, then wait for the engine to populate
  // snapshot + plan via __detect-complete (which lands the state in 'plan').
  const sigintHandler = () => controller.cancel('SIGINT')
  process.on('SIGINT', sigintHandler)
  process.on('SIGTERM', sigintHandler)

  // Resolve as soon as the snapshot + plan are available.
  const ready = new Promise<void>(resolve => {
    const unsub = controller.on('state', (s: OnboardingState) => {
      if (s.kind === 'plan' || s.kind === 'failed' || s.kind === 'cancelled') {
        unsub()
        resolve()
      }
    })
  })
  controller.send({ type: 'next' })
  await ready

  const state = controller.getState()
  if (state.kind !== 'plan') {
    process.stderr.write(`detect-only ended in state '${state.kind}'\n`)
    controller.dispose()
    process.off('SIGINT', sigintHandler)
    process.off('SIGTERM', sigintHandler)
    return 1
  }

  // Render the result. Stop the engine before exiting so we don't print
  // further state transitions.
  controller.cancel('detect-only-complete')

  if (opts.json) {
    const out = { snapshot: state.snapshot, plan: state.plan }
    process.stdout.write(JSON.stringify(out, null, 2) + '\n')
  } else {
    process.stdout.write(formatDetectSummary(state.snapshot, state.plan))
  }
  controller.dispose()
  process.off('SIGINT', sigintHandler)
  process.off('SIGTERM', sigintHandler)
  return 0
}

function formatDetectSummary(snapshot: Extract<OnboardingState, { kind: 'plan' }>['snapshot'], plan: Extract<OnboardingState, { kind: 'plan' }>['plan']): string {
  const lines: string[] = []
  lines.push('')
  lines.push(chalk.bold('  verdict onboarding') + chalk.dim(' (detect-only)'))
  lines.push('')
  lines.push(chalk.bold('  Hardware'))
  lines.push(`    ${snapshot.hardware.cpu} · ${snapshot.hardware.ramGB} GB RAM · ${snapshot.hardware.os} ${snapshot.hardware.osVersion}`)
  if (snapshot.hardware.freeDiskGB !== undefined) {
    lines.push(`    ${snapshot.hardware.freeDiskGB} GB free disk`)
  }
  lines.push('')
  lines.push(chalk.bold('  Local runtimes'))
  lines.push(`    Ollama:    ${snapshot.ollama.installed ? chalk.green('installed') : chalk.dim('missing')}${snapshot.ollama.installSource ? chalk.dim(` (${snapshot.ollama.installSource})`) : ''} · daemon ${snapshot.ollama.daemonRunning ? chalk.green('running') : chalk.dim('stopped')} · ${snapshot.ollama.installedModels.length} model(s)`)
  lines.push(`    MLX:       ${snapshot.mlx.appleSilicon ? chalk.green('Apple Silicon') : chalk.dim('n/a')} · server ${snapshot.mlx.serverRunning ? chalk.green('running') : chalk.dim('stopped')}`)
  lines.push(`    LM Studio: app ${snapshot.lmstudio.appInstalled ? chalk.green('installed') : chalk.dim('missing')} · server ${snapshot.lmstudio.serverRunning ? chalk.green('running') : chalk.dim('stopped')}`)
  lines.push('')
  const keys = Object.entries(snapshot.cloud).filter(([, v]) => v).map(([k]) => k.replace('Key', ''))
  lines.push(chalk.bold('  Cloud keys'))
  lines.push(`    ${keys.length ? chalk.green(keys.join(', ')) : chalk.dim('(none in env)')}`)
  lines.push('')
  lines.push(chalk.bold('  Plan'))
  lines.push(`    intent: ${chalk.cyan(plan.intent)}`)
  lines.push(`    ${plan.rationale}`)
  if (plan.installSteps.length > 0) {
    lines.push('    install steps:')
    plan.installSteps.forEach((s, i) => lines.push(`      ${i + 1}. ${s.label}`))
  }
  if (plan.modelsToPull.length > 0) {
    lines.push(`    models to pull (${plan.estimatedDownloadGB.toFixed(1)} GB total):`)
    plan.modelsToPull.forEach(m => lines.push(`      • ${m.name} (${m.paramsB}B ${m.defaultQuant}, ~${m.estimatedSizeGB} GB, role=${m.role})`))
  }
  if (plan.reuseModels.length > 0) {
    lines.push(`    reusing: ${plan.reuseModels.join(', ')}`)
  }
  if (plan.cloudModels.length > 0) {
    lines.push(`    cloud models: ${plan.cloudModels.map(m => m.id).join(', ')}`)
  }
  lines.push(`    judge: ${plan.judge.modelId} — ${plan.judge.rationale}`)
  lines.push(`    estimated total: ${plan.estimatedDurationMin[0]}–${plan.estimatedDurationMin[1]} min`)
  lines.push('')
  return lines.join('\n')
}

// ─── TUI launcher ──────────────────────────────────────────────────────────

async function runInkTui(opts: OnboardingCliOptions): Promise<number> {
  const controller = startOnboarding({
    configPath: opts.configPath,
    catalogPath: opts.catalogPath,
    resume: opts.resume,
    force: opts.force,
    detectOnly: opts.detectOnly,
  })

  // Render Ink against the existing controller so the engine isn't
  // recreated by the hook. exitOnCtrlC is false because the Onboarding
  // screen handles Ctrl-C → controller.cancel itself (so the engine can
  // clean up before we tear down React).
  const instance = render(
    React.createElement(Onboarding, {
      controller,
      onExit: () => {
        // Stop the Ink reconciler; the surrounding `verdict onboarding`
        // command will exit cleanly with the engine's final code.
        instance.unmount()
      },
    }),
    { exitOnCtrlC: false }
  )

  // SIGINT cleanly cancels through the engine (preserves cleanup).
  const sigintHandler = () => controller.cancel('SIGINT')
  process.on('SIGINT', sigintHandler)
  process.on('SIGTERM', sigintHandler)

  try {
    await instance.waitUntilExit()
  } finally {
    process.off('SIGINT', sigintHandler)
    process.off('SIGTERM', sigintHandler)
  }
  const final = controller.getState()
  controller.dispose()

  if (final.kind === 'done') return 0
  if (final.kind === 'cancelled') return 130
  if (final.kind === 'failed') return 1
  return 0
}

// ─── Headless launcher ─────────────────────────────────────────────────────

async function runHeadless(opts: OnboardingCliOptions): Promise<number> {
  const controller = startOnboarding({
    configPath: opts.configPath,
    catalogPath: opts.catalogPath,
    resume: opts.resume,
    force: opts.force,
    detectOnly: opts.detectOnly,
  })

  let unsubRender = () => undefined as void
  if (opts.json) {
    unsubRender = attachJsonHeadless(controller)
  } else {
    unsubRender = attachPeriodicHeadless(controller)
  }

  const sigintHandler = () => controller.cancel('SIGINT')
  process.on('SIGINT', sigintHandler)
  process.on('SIGTERM', sigintHandler)

  // Headless mode auto-drives through welcome/plan/consent — there's no UI
  // for the user to interact with.
  controller.on('state', (s: OnboardingState) => {
    if (s.kind === 'welcome') {
      setImmediate(() => controller.send({ type: 'next' }))
    } else if (s.kind === 'plan') {
      setImmediate(() => controller.send({ type: 'next' }))
    } else if (s.kind === 'consent') {
      setImmediate(() => controller.send({ type: 'consent-given' }))
    }
  })

  const final = await controller.waitForTerminal()
  process.off('SIGINT', sigintHandler)
  process.off('SIGTERM', sigintHandler)
  unsubRender()
  controller.dispose()

  if (final.kind === 'done') return 0
  if (final.kind === 'cancelled') return 130
  return 1
}
