/**
 * verdict dashboard build — single-command wrapper around the dashboard
 * regeneration + rebuild pipeline.
 *
 * Replaces the manual sequence:
 *   bash scripts/regenerate-dashboard-data.sh
 *   cd dashboard/build && bash rebuild-all.sh
 *
 * Goal: a one-liner that any contributor (or cron job) can run without
 * memorizing the script layout. Streams subprocess output so users see
 * progress.
 */

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'

export interface DashboardBuildOptions {
  /** Skip the data-regeneration step (use existing dashboard-data.json). */
  skipRegenerate?: boolean
  /** Working directory; defaults to process.cwd(). */
  cwd?: string
}

export async function dashboardBuildCommand(opts: DashboardBuildOptions = {}): Promise<void> {
  const cwd = opts.cwd ?? process.cwd()

  const regenerateScript = path.join(cwd, 'scripts', 'regenerate-dashboard-data.sh')
  const rebuildDir = path.join(cwd, 'dashboard', 'build')
  const rebuildScript = path.join(rebuildDir, 'rebuild-all.sh')

  // Pre-flight: make sure the dashboard build system is present.
  const missing: string[] = []
  if (!opts.skipRegenerate && !fs.existsSync(regenerateScript)) missing.push(regenerateScript)
  if (!fs.existsSync(rebuildScript)) missing.push(rebuildScript)
  if (missing.length > 0) {
    console.error(chalk.red('  dashboard build prerequisites missing:'))
    for (const m of missing) console.error(chalk.red(`    - ${m}`))
    console.error(chalk.dim('  → Ensure you are at the repo root and the dashboard/ directory is intact.'))
    process.exit(1)
  }

  console.log(chalk.bold('  verdict') + chalk.dim(' dashboard build'))
  console.log()

  if (!opts.skipRegenerate) {
    console.log(chalk.dim('  [1/2] Regenerating dashboard-data.json from per-run JSON files...'))
    await runScript('bash', [regenerateScript], cwd)
    console.log()
  } else {
    console.log(chalk.dim('  [1/2] Skipped data regeneration (--skip-regenerate)'))
    console.log()
  }

  console.log(chalk.dim('  [2/2] Rebuilding HTML pages...'))
  await runScript('bash', [rebuildScript], rebuildDir)

  console.log()
  console.log(chalk.green('  ✓ Dashboard built.'))
  const indexPath = path.join(cwd, 'dashboard', 'published', 'index.html')
  if (fs.existsSync(indexPath)) {
    console.log(chalk.dim(`    file://${indexPath}`))
  }
}

function runScript(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: 'inherit' })
    proc.on('error', reject)
    proc.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${path.basename(args[0] ?? cmd)} exited with code ${code}`))
    })
  })
}
