/**
 * Shared process-spawning helpers for the install orchestrator. The key
 * abstraction is `runProcess` — wrap `child_process.spawn`, stream stdout/
 * stderr line-by-line, honor an AbortSignal, kill cleanly.
 *
 * `spawn` is injectable for tests via the `spawnFn` parameter.
 */

import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'child_process'

export type SpawnFn = typeof nodeSpawn

export interface RunProcessOptions {
  cmd: string
  args: string[]
  onLine?: (line: string, source: 'stdout' | 'stderr') => void
  signal: AbortSignal
  env?: NodeJS.ProcessEnv
  spawnFn?: SpawnFn
  cwd?: string
}

export interface RunProcessResult {
  code: number
  signal: NodeJS.Signals | null
  stdoutLines: string[]
  stderrLines: string[]
}

/**
 * Run a child process; stream its output line-by-line. Resolves with the
 * exit code (and signal). Rejects with the error string if the process
 * couldn't be spawned at all.
 *
 * Aborting the signal sends SIGTERM, then SIGKILL after 5s if still alive.
 */
export function runProcess(opts: RunProcessOptions): Promise<RunProcessResult> {
  return new Promise((resolve, reject) => {
    const spawnFn = opts.spawnFn ?? nodeSpawn
    const stdoutLines: string[] = []
    const stderrLines: string[] = []
    let child: ChildProcess
    const spawnOpts: SpawnOptions = {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: opts.env ?? process.env,
      cwd: opts.cwd,
    }
    try {
      child = spawnFn(opts.cmd, opts.args, spawnOpts)
    } catch (err) {
      reject(err)
      return
    }

    let stdoutBuf = ''
    let stderrBuf = ''
    const drain = (chunk: Buffer, source: 'stdout' | 'stderr') => {
      const bufRef = source === 'stdout' ? stdoutBuf : stderrBuf
      const buf = bufRef + chunk.toString()
      const lines = buf.split('\n')
      const tail = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '')
        if (source === 'stdout') stdoutLines.push(trimmed)
        else stderrLines.push(trimmed)
        opts.onLine?.(trimmed, source)
      }
      if (source === 'stdout') stdoutBuf = tail
      else stderrBuf = tail
    }

    child.stdout?.on('data', (c: Buffer) => drain(c, 'stdout'))
    child.stderr?.on('data', (c: Buffer) => drain(c, 'stderr'))

    let killTimer: NodeJS.Timeout | null = null
    const onAbort = () => {
      try { child.kill('SIGTERM') } catch { /* noop */ }
      killTimer = setTimeout(() => {
        try { child.kill('SIGKILL') } catch { /* noop */ }
      }, 5000)
    }
    if (opts.signal.aborted) onAbort()
    else opts.signal.addEventListener('abort', onAbort, { once: true })

    child.on('error', err => {
      if (killTimer) clearTimeout(killTimer)
      reject(err)
    })
    child.on('close', (code, sig) => {
      if (killTimer) clearTimeout(killTimer)
      // Flush trailing buffers.
      if (stdoutBuf.length > 0) {
        stdoutLines.push(stdoutBuf)
        opts.onLine?.(stdoutBuf, 'stdout')
      }
      if (stderrBuf.length > 0) {
        stderrLines.push(stderrBuf)
        opts.onLine?.(stderrBuf, 'stderr')
      }
      resolve({ code: code ?? -1, signal: sig, stdoutLines, stderrLines })
    })
  })
}

// ─── Installer step interface ──────────────────────────────────────────────

export interface InstallStepRunner {
  id: string
  label: string
  run(ctx: { onLine: (line: string) => void; signal: AbortSignal }): Promise<void>
}

export interface InstallStepFailure extends Error {
  step: string
  stderr?: string[]
}

export function makeStepFailure(step: string, msg: string, stderr?: string[]): InstallStepFailure {
  const err = new Error(msg) as InstallStepFailure
  err.step = step
  err.stderr = stderr
  return err
}
