/**
 * `verdict onboarding` CLI command. Wraps the engine, picks the right
 * renderer (TUI or headless) based on environment.
 */

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

  // 3. Start the engine.
  const headless =
    opts.headless ||
    opts.json ||
    !process.stdout.isTTY ||
    !!process.env['CI']

  const controller = startOnboarding({
    configPath: opts.configPath,
    catalogPath: opts.catalogPath,
    resume: opts.resume,
    force: opts.force,
    detectOnly: opts.detectOnly,
  })

  // 4. Attach renderer.
  let unsubRender = () => undefined as void
  if (opts.json) {
    unsubRender = attachJsonHeadless(controller)
  } else if (headless) {
    unsubRender = attachPeriodicHeadless(controller)
  } else {
    // Default: still headless until the TUI screen lands (we'll wire the
    // Ink screen in a later milestone). The periodic renderer is the most
    // useful default for now.
    unsubRender = attachPeriodicHeadless(controller)
  }

  // 5. Install signal handlers so Ctrl-C cleanly cancels.
  const sigintHandler = () => controller.cancel('SIGINT')
  process.on('SIGINT', sigintHandler)
  process.on('SIGTERM', sigintHandler)

  // 6. Auto-drive: from welcome → next; from plan → next; from consent →
  // consent-given. The TUI version of this will obviously stop for user
  // input. For now, headless mode auto-advances based on the plan.
  controller.on('state', (s: OnboardingState) => {
    if (s.kind === 'welcome') {
      // Begin detect right away.
      setImmediate(() => controller.send({ type: 'next' }))
    } else if (s.kind === 'plan') {
      // Auto-confirm in headless mode.
      setImmediate(() => controller.send({ type: 'next' }))
    } else if (s.kind === 'consent') {
      // Auto-confirm. Real consent prompts come from the TUI.
      setImmediate(() => controller.send({ type: 'consent-given' }))
    }
  })

  // 7. Wait for terminal.
  const final = await controller.waitForTerminal()
  process.off('SIGINT', sigintHandler)
  process.off('SIGTERM', sigintHandler)
  unsubRender()
  controller.dispose()

  if (final.kind === 'done') return 0
  if (final.kind === 'cancelled') return 130
  return 1
}
