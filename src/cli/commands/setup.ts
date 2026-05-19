/**
 * verdict setup --autonomous — one-command 24/7 setup.
 *
 * Goal: from `verdict init` to "machine runs Verdict on cron forever" in
 * one command, idempotently. Wraps Hermes cron setup, dashboard
 * preflight, and surfaces follow-on hints (telemetry, notifications).
 */

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'

export interface SetupOptions {
  autonomous?: boolean
  cwd?: string
  /** Skip the Hermes cron call (smoke-test mode). */
  dryRun?: boolean
}

export async function setupCommand(opts: SetupOptions): Promise<void> {
  const cwd = opts.cwd ?? process.cwd()

  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' setup'))
  console.log()

  if (!opts.autonomous) {
    console.log(chalk.yellow('  Nothing to do without --autonomous.'))
    console.log(chalk.dim('  Try: verdict setup --autonomous'))
    return
  }

  // 1. Verify we're at the repo root.
  const cronFile = path.join(cwd, 'cron', 'verdict-hourly.yaml')
  if (!fs.existsSync(cronFile)) {
    console.error(chalk.red(`  Can't find ${cronFile}.`))
    console.error(chalk.dim('  → Run this from the root of the Verdict repository.'))
    process.exit(1)
  }

  // 2. Check Hermes is installed.
  const hermesAvailable = which('hermes')
  if (!hermesAvailable) {
    console.error(chalk.red('  hermes command not found on PATH.'))
    console.error(chalk.dim('  → Install Hermes Agent first: https://github.com/anthropics/hermes'))
    console.error(chalk.dim('  → Or run scripts/verdict-runner.sh manually from your own cron.'))
    process.exit(1)
  }

  // 3. Create or confirm the cron job.
  console.log(chalk.dim('  [1/3] Creating Hermes cron job...'))
  if (!opts.dryRun) {
    const result = spawnSync('hermes', ['cron', 'create', '--file', cronFile], {
      cwd, stdio: 'inherit',
    })
    if (result.status !== 0 && result.status !== null) {
      console.error(chalk.yellow(`  hermes returned exit ${result.status} — the job may already exist.`))
      console.error(chalk.dim('  → Run `hermes cron list` to verify.'))
    }
  } else {
    console.log(chalk.dim('    (dry-run: would run `hermes cron create --file cron/verdict-hourly.yaml`)'))
  }
  console.log()

  // 4. Verify dashboard prerequisites.
  console.log(chalk.dim('  [2/3] Checking dashboard build path...'))
  const dashboardScript = path.join(cwd, 'dashboard', 'build', 'rebuild-all.sh')
  if (fs.existsSync(dashboardScript)) {
    console.log(chalk.green('    ✓ dashboard/build/ ready'))
  } else {
    console.log(chalk.yellow(`    ⚠ ${dashboardScript} not found — dashboard regeneration will be skipped.`))
  }
  console.log()

  // 5. Surface follow-on hints.
  console.log(chalk.dim('  [3/3] Optional next steps:'))
  const { loadPrefs } = await import('../../utils/telemetry.js')
  if (loadPrefs() === null) {
    console.log(chalk.dim('    • `verdict telemetry on` — opt in to anonymous run counts'))
  }
  console.log(chalk.dim('    • Add a `notify:` block to verdict.yaml for Slack/email hooks'))
  console.log(chalk.dim('    • `hermes cron list` to verify the job is scheduled'))
  console.log(chalk.dim('    • `hermes cron run verdict-hourly-eval` to trigger one now'))
  console.log()

  console.log(chalk.green('  ✓ Autonomous setup complete.'))
  console.log()
}

function which(cmd: string): boolean {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd])
  return r.status === 0
}
