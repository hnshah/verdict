/**
 * `verdict daemon` CLI commands — start/stop/status/logs for the background job daemon.
 */

import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import { sendIpc } from '../../daemon/ipc.js'
import type { DaemonStatus } from '../../daemon/index.js'

const VERDICT_DIR = path.join(os.homedir(), '.verdict')
const PID_FILE = path.join(VERDICT_DIR, 'daemon.pid')
const LOG_FILE = path.join(VERDICT_DIR, 'daemon.log')

/** Check if a process with the given PID is alive. */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Read daemon PID from file, or null if not running. */
function readPid(): number | null {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10)
    return isProcessAlive(pid) ? pid : null
  } catch {
    return null
  }
}

/** Format seconds into a human-readable uptime string. */
function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

export async function daemonStartCommand(): Promise<void> {
  console.log()

  const existingPid = readPid()
  if (existingPid !== null) {
    console.log(chalk.yellow(`  verdict daemon already running (pid: ${existingPid})`))
    console.log(chalk.dim('  Use `verdict daemon stop` to stop it first.'))
    console.log()
    return
  }

  // Find the worker entry point
  // In dev: use tsx to run TS directly; in dist: use node
  const workerPath = path.resolve(
    new URL(import.meta.url).pathname,
    '..', '..', '..', 'daemon', 'worker.js'
  )

  // Resolve to .ts for dev or .js for dist
  const tsWorkerPath = workerPath.replace(/\.js$/, '.ts')
  const useTs = fs.existsSync(tsWorkerPath) && !fs.existsSync(workerPath)

  const cmd = useTs ? 'npx' : 'node'
  const args = useTs ? ['tsx', tsWorkerPath] : [workerPath]

  if (!fs.existsSync(VERDICT_DIR)) fs.mkdirSync(VERDICT_DIR, { recursive: true })

  const logStream = fs.openSync(LOG_FILE, 'a')
  const child = spawn(cmd, args, {
    detached: true,
    stdio: ['ignore', logStream, logStream],
    env: { ...process.env },
  })

  child.unref()

  const pid = child.pid
  console.log(chalk.green(`  → verdict daemon started (pid: ${pid})`))
  console.log(chalk.dim(`    logs: ${LOG_FILE}`))
  console.log()
}

export async function daemonStopCommand(): Promise<void> {
  console.log()

  try {
    const response = await sendIpc({ action: 'stop' })
    if (response.ok) {
      console.log(chalk.green('  → verdict daemon stopped'))
    } else {
      console.log(chalk.red(`  Failed to stop daemon: ${response.error}`))
    }
  } catch {
    // Fallback: kill via PID
    const pid = readPid()
    if (pid !== null) {
      try {
        process.kill(pid, 'SIGTERM')
        console.log(chalk.green(`  → verdict daemon stopped (pid: ${pid})`))
        try { fs.unlinkSync(PID_FILE) } catch { /* ok */ }
      } catch {
        console.log(chalk.red('  Failed to stop daemon'))
      }
    } else {
      console.log(chalk.dim('  No daemon running'))
    }
  }
  console.log()
}

export async function daemonStatusCommand(): Promise<void> {
  console.log()

  let status: DaemonStatus | null = null

  // Try IPC first
  try {
    const resp = await sendIpc({ action: 'status' })
    if (resp.ok && resp.data) {
      status = resp.data as DaemonStatus
    }
  } catch {
    // IPC not available
  }

  // Fallback: check PID file
  if (!status) {
    const pid = readPid()
    if (pid !== null) {
      console.log(chalk.yellow(`  verdict daemon — running (pid: ${pid}) [IPC unavailable]`))
    } else {
      console.log(chalk.dim('  verdict daemon — not running'))
      console.log(chalk.dim('  Start with: verdict daemon start'))
    }
    console.log()
    return
  }

  const uptime = status.uptimeSeconds ? formatUptime(status.uptimeSeconds) : '-'
  console.log(chalk.green(`  verdict daemon — running (pid: ${status.pid}, uptime: ${uptime})`))
  console.log()

  console.log(`  Queue:    ${status.queueDepth} jobs pending`)
  if (status.currentJob) {
    const model = status.currentJob.model ?? '[auto]'
    console.log(`  Running:  ${model} ${status.currentJob.type}`)
  } else {
    console.log(chalk.dim('  Running:  idle'))
  }
  console.log(`  Today:    ${status.completedToday} jobs done, ${status.failedToday} failed`)

  // Show recent jobs from DB
  try {
    const { getDb, initSchema, getJobs } = await import('../../db/client.js')
    const db = getDb()
    initSchema(db)
    const recentJobs = getJobs(db, { limit: 5 })
    db.close()

    if (recentJobs.length > 0) {
      console.log()
      console.log('  Recent jobs:')
      for (const job of recentJobs) {
        const icon = job.status === 'done' ? chalk.green('✓') :
          job.status === 'failed' ? chalk.red('✗') :
          job.status === 'running' ? chalk.yellow('→') :
          chalk.dim('○')
        const model = job.model_id ?? '[auto]'
        const time = job.completed_at ?? job.queued_at
        const shortTime = time.slice(0, 16).replace('T', ' ')
        const err = job.status === 'failed' && job.error ? chalk.red(` [${job.error.slice(0, 30)}]`) : ''
        console.log(`    ${icon} ${job.type.padEnd(6)} ${model.padEnd(20)} ${shortTime}${err}`)
      }
    }
  } catch {
    // DB not available, skip recent jobs
  }

  console.log()
}

export async function daemonLogsCommand(opts: { tail?: string }): Promise<void> {
  const n = parseInt(opts.tail ?? '50', 10)

  if (!fs.existsSync(LOG_FILE)) {
    console.log(chalk.dim('  No daemon logs found'))
    console.log(chalk.dim(`  Expected at: ${LOG_FILE}`))
    return
  }

  const content = fs.readFileSync(LOG_FILE, 'utf8')
  const lines = content.trim().split('\n')
  const tail = lines.slice(-n)

  for (const line of tail) {
    // Color-code log lines
    if (line.includes('failed') || line.includes('error')) {
      console.log(chalk.red(line))
    } else if (line.includes('done')) {
      console.log(chalk.green(line))
    } else if (line.includes('starting')) {
      console.log(chalk.cyan(line))
    } else {
      console.log(chalk.dim(line))
    }
  }
}

/** Internal worker command — runs the daemon in-process (used by spawned child). */
export async function daemonWorkerCommand(): Promise<void> {
  // This is a no-op in the CLI — the actual worker is src/daemon/worker.ts
  // This command exists for routing purposes when using `verdict daemon worker`
  await import('../../daemon/worker.js')
}
