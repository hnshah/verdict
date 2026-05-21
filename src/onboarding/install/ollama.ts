/**
 * Ollama install + daemon-start step runners.
 *
 * Install:
 *   - `brew install ollama` (default if Homebrew is present, reversible).
 *   - `curl -fsSL https://ollama.com/install.sh | sh` as opt-in fallback.
 *
 * Daemon:
 *   - `ollama serve` spawned detached + unref'd, redirected to a log file.
 *   - Poll `/api/tags` up to 30s for readiness.
 *   - Record our PID so the engine knows whether to kill on cancel.
 *
 * Public functions return InstallStepRunner objects so the orchestrator can
 * call them in sequence and stream their output to the UI.
 */

import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

import { isOllamaRunning } from '../../providers/ollama.js'
import { ensureVerdictDir, getVerdictDir } from '../persistence.js'
import { runProcess, type InstallStepRunner, type SpawnFn, makeStepFailure } from './runtime.js'

export interface InstallOllamaOptions {
  method: 'brew' | 'curl'
  /** Inject for tests. */
  spawnFn?: SpawnFn
}

export function installOllama(opts: InstallOllamaOptions): InstallStepRunner {
  return {
    id: 'install-ollama',
    label: opts.method === 'brew' ? 'Install Ollama (brew)' : 'Install Ollama (install.sh)',
    async run({ onLine, signal }) {
      const { cmd, args } = installCmd(opts.method)
      const result = await runProcess({
        cmd,
        args,
        onLine: (line, _src) => onLine(line),
        signal,
        spawnFn: opts.spawnFn,
      })
      if (signal.aborted) {
        throw makeStepFailure('install-ollama', 'install canceled')
      }
      if (result.code !== 0) {
        throw makeStepFailure(
          'install-ollama',
          `${cmd} exited with code ${result.code}`,
          result.stderrLines
        )
      }
    },
  }
}

function installCmd(method: 'brew' | 'curl'): { cmd: string; args: string[] } {
  if (method === 'brew') {
    return { cmd: 'brew', args: ['install', 'ollama'] }
  }
  // The official curl|sh installer. We invoke it via `sh -c` so the user
  // sees the same script they'd run themselves.
  return {
    cmd: 'sh',
    args: ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'],
  }
}

// ─── Daemon ─────────────────────────────────────────────────────────────────

export interface StartOllamaOptions {
  host?: string // 'localhost:11434'
  readinessTimeoutMs?: number
  /** Inject for tests. */
  spawnFn?: SpawnFn
  /** Inject for tests. */
  isRunning?: (host: string) => Promise<boolean>
}

export interface StartedDaemon {
  /** True if we spawned the daemon (false if it was already running). */
  spawned: boolean
  pid?: number
  logPath?: string
}

export const OLLAMA_PID_FILE = path.join(getVerdictDir(), 'ollama-onboarding.pid')
export const OLLAMA_LOG_FILE = path.join(getVerdictDir(), 'ollama-onboarding.log')

export function startOllamaDaemon(opts: StartOllamaOptions = {}): InstallStepRunner {
  const host = opts.host ?? 'localhost:11434'
  const readinessTimeoutMs = opts.readinessTimeoutMs ?? 30_000
  const spawnFn = opts.spawnFn ?? spawn
  const isRunning = opts.isRunning ?? isOllamaRunning

  return {
    id: 'start-ollama',
    label: 'Start Ollama daemon',
    async run({ onLine, signal }) {
      // If already running, don't touch it.
      if (await isRunning(host)) {
        onLine('Ollama already running — not starting a new daemon.')
        return
      }
      ensureVerdictDir()
      const out = fs.openSync(OLLAMA_LOG_FILE, 'a')
      onLine(`Spawning: ollama serve  (log: ${OLLAMA_LOG_FILE})`)
      const child = spawnFn('ollama', ['serve'], {
        detached: true,
        stdio: ['ignore', out, out],
        env: process.env,
      })
      if (!child.pid) {
        throw makeStepFailure('start-ollama', 'ollama serve failed to spawn')
      }
      child.unref?.()
      fs.writeFileSync(OLLAMA_PID_FILE, String(child.pid))
      onLine(`Waiting for daemon to become ready on ${host}…`)

      const deadline = Date.now() + readinessTimeoutMs
      while (Date.now() < deadline) {
        if (signal.aborted) {
          // Best effort cleanup — kill the daemon WE just started.
          try { process.kill(child.pid, 'SIGTERM') } catch { /* noop */ }
          throw makeStepFailure('start-ollama', 'cancelled')
        }
        if (await isRunning(host)) {
          onLine('Ollama is ready.')
          return
        }
        await sleep(500)
      }
      throw makeStepFailure(
        'start-ollama',
        `ollama serve did not become ready within ${readinessTimeoutMs}ms`
      )
    },
  }
}

/**
 * Kill the Ollama daemon WE started (recorded in OLLAMA_PID_FILE). Idempotent
 * and best-effort — never throws. Used on cancel for tasks that started the
 * daemon as part of onboarding.
 */
export function killStartedOllama(): void {
  try {
    if (!fs.existsSync(OLLAMA_PID_FILE)) return
    const pid = Number(fs.readFileSync(OLLAMA_PID_FILE, 'utf-8').trim())
    if (Number.isFinite(pid) && pid > 0) {
      try { process.kill(pid, 'SIGTERM') } catch { /* already dead */ }
    }
    fs.unlinkSync(OLLAMA_PID_FILE)
  } catch {
    // best-effort
  }
}

// ─── Cloud key capture ──────────────────────────────────────────────────────

/**
 * Write a single API key into the project's .env file. Idempotent: if the
 * key is already present, leaves the file alone. Never overwrites unrelated
 * keys.
 */
export function writeCloudKey(opts: {
  rootDir?: string
  envVar: string
  value: string
}): { wrote: boolean; envPath: string } {
  const rootDir = opts.rootDir ?? process.cwd()
  const envPath = path.join(rootDir, '.env')
  const line = `${opts.envVar}=${opts.value}`
  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, 'utf-8')
    const re = new RegExp(`^${opts.envVar}=`, 'm')
    if (re.test(text)) {
      return { wrote: false, envPath }
    }
    const sep = text.endsWith('\n') ? '' : '\n'
    fs.writeFileSync(envPath, text + sep + line + '\n')
  } else {
    fs.writeFileSync(envPath, line + '\n')
  }
  return { wrote: true, envPath }
}

// ─── Helper ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
