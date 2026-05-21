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
    if (mark.status === 'in-progress' && !isMarkStale(mark) && !opts.resume) {
      process.stdout.write(
        chalk.yellow(
          'An onboarding run is already in progress. Use --resume to continue or --force to restart.\n'
        )
      )
      return 1
    }
  }

  // 3. Pick renderer mode. Explicit --headless/--json wins; otherwise prefer
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
