/**
 * Environment detection. Single entry point `detect()` runs all probes
 * in parallel with per-probe timeouts and returns a Snapshot. Each probe
 * is independently failable — a timed-out probe yields a default value
 * rather than aborting the whole detection.
 *
 * The progress callback fires `pending → running → done` per step so the
 * UI can render a checklist as detection unfolds.
 */

import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

import { detectHardware } from '../core/hardware.js'
import { isOllamaRunning, listOllamaModels } from '../providers/ollama.js'
import { isMLXRunning } from '../providers/mlx.js'
import { isLMStudioRunning } from '../providers/lmstudio.js'
import { loadConfig } from '../core/config.js'
import type {
  CloudSnapshot,
  ConfigSnapshot,
  DetectProgress,
  DetectStep,
  HardwareSnapshot,
  LmStudioSnapshot,
  MlxSnapshot,
  OllamaSnapshot,
  Snapshot,
} from './events.js'

const DEFAULT_OLLAMA_HOST = 'localhost:11434'
const DEFAULT_MLX_PORT = 8080
const DEFAULT_LMSTUDIO_PORT = 1234

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve a binary on PATH. Captures stderr and never invokes anything that
 * might fire the xcode-select GUI popup on macOS — `spawnSync('which', ...)`
 * is safe; `spawnSync('python3', ...)` is NOT on a bare macOS install.
 */
export function which(bin: string): string | undefined {
  try {
    const r = spawnSync('which', [bin], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
    if (r.status !== 0) return undefined
    const out = r.stdout.trim()
    return out.length > 0 ? out : undefined
  } catch {
    return undefined
  }
}

function ollamaVersion(): string | undefined {
  try {
    const r = spawnSync('ollama', ['--version'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
    if (r.status !== 0) return undefined
    // "ollama version is 0.5.0" or "Warning: client version is X..." — extract the version-y substring
    const m = r.stdout.match(/[0-9]+\.[0-9]+(?:\.[0-9]+)?/)
    return m?.[0]
  } catch {
    return undefined
  }
}

/**
 * Run a function with a hard timeout. If it doesn't resolve in `ms`, the
 * `fallback` is returned. The original promise is not cancelled (Node has
 * no general cancellation) but its result is discarded.
 */
async function withTimeout<T>(fn: () => Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve(fallback)
    }, ms)
    fn().then(
      v => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(v)
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(fallback)
      }
    )
  })
}

/**
 * Single TCP probe to a known reliable endpoint. Avoids DNS so we measure
 * raw connectivity, not DNS health.
 */
export function probeInternet(host = '1.1.1.1', port = 443, timeoutMs = 2000): Promise<boolean> {
  return new Promise(resolve => {
    const sock = net.connect({ host, port, timeout: timeoutMs })
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      try { sock.destroy() } catch { /* noop */ }
      resolve(ok)
    }
    sock.once('connect', () => finish(true))
    sock.once('timeout', () => finish(false))
    sock.once('error', () => finish(false))
  })
}

// ─── Individual probes ──────────────────────────────────────────────────────

async function probeHardware(): Promise<HardwareSnapshot> {
  const hw = detectHardware()
  return {
    cpu: hw.cpu,
    cpuCores: hw.cpuCores,
    cpuArch: hw.cpuArch,
    ram: hw.ram,
    ramGB: hw.ramGB,
    freeDiskGB: hw.freeDiskGB,
    os: hw.os,
    osVersion: hw.osVersion,
    gpu: hw.gpu,
  }
}

async function probeOllama(host: string): Promise<OllamaSnapshot> {
  const binPath = which('ollama')
  const installed = binPath !== undefined
  const version = installed ? ollamaVersion() : undefined
  const daemonRunning = await isOllamaRunning(host)
  const installedModels = daemonRunning ? await listOllamaModels(host) : []
  return { installed, binPath, version, daemonRunning, installedModels }
}

async function probeMLX(port: number): Promise<MlxSnapshot> {
  const appleSilicon = os.platform() === 'darwin' && os.arch() === 'arm64'
  const serverRunning = await isMLXRunning(port)
  // We do NOT probe `python3 -c 'import mlx_lm'` — `spawnSync('python3', ...)` on
  // a bare macOS install triggers the xcode-select developer-tools GUI popup.
  // Treat MLX as "available if Apple Silicon + you'll opt in"; the installer
  // step itself runs the import check in a safe wrapper.
  return { appleSilicon, mlxLmInstalled: false, serverRunning, port: serverRunning ? port : undefined }
}

async function probeLMStudio(port: number): Promise<LmStudioSnapshot> {
  // macOS-only check for the app bundle. Linux LM Studio is AppImage-based;
  // we don't probe install presence there.
  let appInstalled = false
  if (os.platform() === 'darwin') {
    appInstalled =
      fs.existsSync('/Applications/LM Studio.app') ||
      fs.existsSync(path.join(os.homedir(), 'Applications/LM Studio.app'))
  }
  const serverRunning = await isLMStudioRunning('localhost', port)
  return { appInstalled, serverRunning }
}

function probeCloud(): CloudSnapshot {
  return {
    openrouterKey: !!process.env['OPENROUTER_API_KEY'],
    anthropicKey: !!process.env['ANTHROPIC_API_KEY'],
    openaiKey: !!process.env['OPENAI_API_KEY'],
    groqKey: !!process.env['GROQ_API_KEY'],
  }
}

async function probeConfig(configPath = './verdict.yaml'): Promise<ConfigSnapshot> {
  const abs = path.resolve(configPath)
  const exists = fs.existsSync(abs)
  if (!exists) return { exists: false, issues: [] }
  try {
    const cfg = loadConfig(configPath)
    return {
      exists: true,
      path: abs,
      valid: true,
      issues: [],
      modelCount: cfg.models.length,
    }
  } catch (err) {
    return {
      exists: true,
      path: abs,
      valid: false,
      issues: [err instanceof Error ? err.message : String(err)],
    }
  }
}

async function probeHomebrew(): Promise<{ installed: boolean; path?: string }> {
  const p = which('brew')
  return { installed: p !== undefined, path: p }
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export interface DetectOptions {
  ollamaHost?: string
  mlxPort?: number
  lmstudioPort?: number
  configPath?: string
  onProgress?: (progress: DetectProgress) => void
  /** Total wall-clock budget per probe. Default 3s. */
  probeTimeoutMs?: number
}

const STEPS: DetectStep[] = [
  'hardware',
  'ollama-bin',
  'ollama-daemon',
  'mlx',
  'lmstudio',
  'cloud',
  'network',
  'homebrew',
  'config',
]

function freshProgress(): DetectProgress {
  return STEPS.reduce(
    (acc, s) => ({ ...acc, [s]: 'pending' as const }),
    {} as DetectProgress
  )
}

export async function detect(opts: DetectOptions = {}): Promise<Snapshot> {
  const ollamaHost =
    opts.ollamaHost || process.env['OLLAMA_HOST'] || DEFAULT_OLLAMA_HOST
  const mlxPort =
    opts.mlxPort || Number(process.env['MLX_PORT']) || DEFAULT_MLX_PORT
  const lmPort =
    opts.lmstudioPort || Number(process.env['LMSTUDIO_PORT']) || DEFAULT_LMSTUDIO_PORT
  const configPath = opts.configPath || './verdict.yaml'
  const probeTimeoutMs = opts.probeTimeoutMs ?? 3000

  const progress: DetectProgress = freshProgress()
  const report = () => opts.onProgress?.({ ...progress })

  const runStep = async <T>(
    step: DetectStep,
    fn: () => Promise<T>,
    fallback: T
  ): Promise<T> => {
    progress[step] = 'running'
    report()
    const result = await withTimeout(fn, probeTimeoutMs, fallback)
    progress[step] = 'done'
    report()
    return result
  }

  report()

  // Run all probes in parallel. Each updates its own progress entry. The
  // wall time = the slowest probe (bounded by probeTimeoutMs).
  const [hardware, ollama, mlx, lmstudio, cloud, network, homebrew, config] =
    await Promise.all([
      runStep('hardware', probeHardware, defaultHardware()),
      runStep('ollama-bin', async () => probeOllama(ollamaHost), {
        installed: false,
        daemonRunning: false,
        installedModels: [],
      } satisfies OllamaSnapshot),
      runStep('mlx', async () => probeMLX(mlxPort), {
        appleSilicon: false,
        mlxLmInstalled: false,
        serverRunning: false,
      } satisfies MlxSnapshot),
      runStep('lmstudio', async () => probeLMStudio(lmPort), {
        appInstalled: false,
        serverRunning: false,
      } satisfies LmStudioSnapshot),
      runStep('cloud', async () => probeCloud(), {
        openrouterKey: false,
        anthropicKey: false,
        openaiKey: false,
        groqKey: false,
      } satisfies CloudSnapshot),
      runStep('network', async () => probeInternet(), false),
      runStep('homebrew', probeHomebrew, { installed: false }),
      runStep('config', async () => probeConfig(configPath), {
        exists: false,
        issues: [],
      } satisfies ConfigSnapshot),
    ])

  // `ollama-daemon` is folded into `probeOllama` for efficiency, but the
  // UI's checklist tracks it as a distinct step. Mark it done after the
  // probe returns.
  progress['ollama-daemon'] = 'done'
  report()

  return {
    capturedAt: new Date().toISOString(),
    hardware,
    ollama,
    mlx,
    lmstudio,
    cloud,
    config,
    network: { online: network },
    homebrew,
  }
}

function defaultHardware(): HardwareSnapshot {
  return {
    cpu: 'Unknown',
    cpuCores: 1,
    cpuArch: os.arch(),
    ram: '0 GB',
    ramGB: 0,
    os: os.platform(),
    osVersion: os.release(),
  }
}
