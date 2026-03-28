/**
 * `verdict watch` CLI command — poll local backends for new models.
 */

import chalk from 'chalk'
import { getDb, initSchema } from '../../db/client.js'
import { ModelWatcher } from '../../daemon/watcher.js'
import type { WatchEvent } from '../../daemon/watcher.js'

interface WatchOptions {
  continuous?: boolean
  interval?: string
  noAutoEval?: boolean
}

function printEvents(events: WatchEvent[]): void {
  if (events.length === 0) {
    console.log(chalk.dim('  No changes detected'))
    return
  }

  for (const ev of events) {
    const icon = ev.type === 'added' ? chalk.green('+')
      : ev.type === 'removed' ? chalk.red('-')
      : chalk.yellow('~')
    const provider = chalk.dim(`[${ev.provider}]`)
    const auto = ev.autoEvalQueued ? chalk.cyan(' → eval queued') : ''
    console.log(`  ${icon} ${ev.model} ${provider}${auto}`)
  }
}

export async function watchCommand(opts: WatchOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' watch'))
  console.log()

  const db = getDb()
  initSchema(db)

  const intervalSec = parseInt(opts.interval ?? '60', 10)
  const watcher = new ModelWatcher(db, {
    pollIntervalMs: intervalSec * 1000,
  })

  // If --no-auto-eval, we need to disable auto_eval on any newly inserted rows
  // The watcher respects the auto_eval column, but for new detections we control it here

  console.log(chalk.dim(`  Polling: Ollama (11434), MLX (8080), LM Studio (1234)`))
  if (opts.continuous) {
    console.log(chalk.dim(`  Interval: ${intervalSec}s (continuous mode — Ctrl+C to stop)`))
  }
  if (opts.noAutoEval) {
    console.log(chalk.dim('  Auto-eval: disabled'))
    // Set auto_eval=0 for all existing watched models
    db.prepare('UPDATE watched_models SET auto_eval = 0').run()
  }
  console.log()

  const knownBefore = await watcher.getKnownModels()
  if (knownBefore.length > 0) {
    console.log(chalk.dim(`  Known models: ${knownBefore.length}`))
    for (const m of knownBefore) {
      console.log(chalk.dim(`    ${m}`))
    }
    console.log()
  }

  // First poll
  const events = await watcher.poll()
  printEvents(events)

  if (!opts.continuous) {
    db.close()
    console.log()
    return
  }

  // Continuous mode
  const poll = async (): Promise<void> => {
    const ts = new Date().toLocaleTimeString()
    console.log()
    console.log(chalk.dim(`  [${ts}] polling...`))
    const events = await watcher.poll()
    printEvents(events)
  }

  const intervalId = setInterval(() => {
    poll().catch(err => {
      console.error(chalk.red(`  Poll error: ${err instanceof Error ? err.message : String(err)}`))
    })
  }, intervalSec * 1000)

  // Graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(intervalId)
    db.close()
    console.log()
    console.log(chalk.dim('  Stopped'))
    process.exit(0)
  })
}
