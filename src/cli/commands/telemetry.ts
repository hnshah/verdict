/**
 * verdict telemetry — manage opt-in anonymous telemetry.
 *
 * Subcommands:
 *   verdict telemetry on      → opt in
 *   verdict telemetry off     → opt out
 *   verdict telemetry status  → show current state
 */

import chalk from 'chalk'
import { enable, disable, loadPrefs, statusLine } from '../../utils/telemetry.js'

export function telemetryOnCommand(): void {
  const prefs = enable()
  console.log(chalk.green('  ✓ Telemetry enabled.'))
  console.log(chalk.dim(`    install_id: ${prefs.install_id}`))
  console.log(chalk.dim('    Sent per run: install_id, day, models_count, packs_count, verdict_version.'))
  console.log(chalk.dim('    Never sent: prompts, scores, model names, paths, hostnames.'))
  console.log(chalk.dim('    Disable any time with `verdict telemetry off`.'))
}

export function telemetryOffCommand(): void {
  disable()
  console.log(chalk.yellow('  ✓ Telemetry disabled.'))
  console.log(chalk.dim('    Re-enable any time with `verdict telemetry on`.'))
}

export function telemetryStatusCommand(): void {
  console.log('  ' + statusLine())
  const prefs = loadPrefs()
  if (prefs?.enabled && !process.env['VERDICT_TELEMETRY_URL']) {
    console.log(chalk.dim('    Note: VERDICT_TELEMETRY_URL not set, so no pings are sent yet.'))
  }
}
