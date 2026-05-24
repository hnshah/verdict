/**
 * Machine-headroom inspection (macOS).
 *
 * Captures the live state of this machine — CPU load, memory pressure, swap,
 * free disk, installed/running Ollama models — and produces a single verdict
 * (`quiet` / `benchmark` / `unsafe`) that the rest of Verdict uses to decide
 * whether to keep models warm, run a benchmark, or back off.
 *
 * Pure logic lives here so it can be unit-tested with a fake `Probe`. The CLI
 * wrapper at `src/cli/commands/machine.ts` is the only place that runs real
 * subprocesses.
 *
 * Phase 1 scope is macOS only; non-Darwin platforms get a clear error rather
 * than a half-baked snapshot.
 */

import { execSync } from 'child_process'
import os from 'os'

export type Verdict = 'quiet' | 'benchmark' | 'unsafe'
export type MemoryPressure = 'normal' | 'warn' | 'critical'

export interface OllamaModel {
  name: string
  size_bytes: number
  modified?: string
}

export interface OllamaRunning {
  name: string
  size_bytes: number
  context?: number
  processor?: string
}

export interface MachineSnapshot {
  ts: string
  hardware: {
    cpu: string
    cpu_cores: number
    cpu_arch: string
    apple_silicon: boolean
    unified_memory: boolean
    ram_gb: number
    os: string
    os_version: string
  }
  load: {
    load1: number
    load5: number
    load15: number
    load1_per_core: number
  }
  memory: {
    free_pct: number
    compressed_pct: number
    wired_pct: number
    pressure: MemoryPressure
    pressure_source: 'sysctl' | 'vm_stat' | 'unavailable'
  }
  swap: {
    total_mb: number
    used_mb: number
    delta_mb_over_sample?: number
    sample_ms: number
  }
  disk: {
    free_gb: number
    min_reserve_gb: number
  }
  ollama: {
    available: boolean
    installed: OllamaModel[]
    running: OllamaRunning[]
    installed_total_gb: number
    running_total_gb: number
  }
  verdict: {
    state: Verdict
    reasons: string[]
  }
}

export interface Thresholds {
  /** Disk reserve we want to keep free; below this we refuse pulls. */
  min_free_disk_gb: number
  /** Swap growth (MB) during the sample beyond which swap is "growing fast". */
  max_swap_delta_mb: number
  /** load1 / cpu_cores ratio above which load is "high". */
  load_high_ratio: number
  /** load1 / cpu_cores ratio above which load is "critical". */
  load_critical_ratio: number
  /** Free memory % below which we're in `warn` (fallback path only). */
  mem_free_warn_pct: number
  /** Free memory % below which we're in `critical` (fallback path only). */
  mem_free_critical_pct: number
  /**
   * Fraction of total RAM that running Ollama models are allowed to occupy
   * before we escalate to `benchmark`. 0.7 means: if running models claim more
   * than 70% of RAM (e.g. 17 GB on a 24 GB machine), back off.
   */
  running_model_ram_warn_ratio: number
  /** Same as above but escalates to `unsafe`. */
  running_model_ram_critical_ratio: number
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  min_free_disk_gb: 25,
  max_swap_delta_mb: 200,
  load_high_ratio: 0.7,
  load_critical_ratio: 1.0,
  mem_free_warn_pct: 10,
  mem_free_critical_pct: 5,
  running_model_ram_warn_ratio: 0.6,
  running_model_ram_critical_ratio: 0.85,
}

/**
 * Pluggable probe — real impl lives in this file (createRealProbe), fake impl
 * in tests. Every probe call returns `undefined` on failure rather than
 * throwing, so partial machines (e.g. no Ollama installed) still snapshot.
 */
export interface Probe {
  loadAvg(): [number, number, number]
  /** Canonical macOS pressure (0=normal, 1=warn, 2=critical) via sysctl. */
  pressureSysctl(): MemoryPressure | undefined
  /** Page-class breakdown, used for display + fallback when sysctl is unavailable. */
  vmStat(): { free_pct: number; compressed_pct: number; wired_pct: number } | undefined
  swapUsage(): { total_mb: number; used_mb: number } | undefined
  swapUsageAfterDelay(delayMs: number): Promise<{ total_mb: number; used_mb: number } | undefined>
  freeDiskGB(): number | undefined
  ollamaList(): OllamaModel[] | undefined
  ollamaPs(): OllamaRunning[] | undefined
  hardware(): MachineSnapshot['hardware']
  /** Optional progress hook, called once just before the swap sample sleep. */
  onSampleStart?(delayMs: number): void
}

/** Compute pressure when the canonical sysctl is unavailable (e.g. on a fake probe). */
export function computeMemoryPressureFallback(
  vm: { free_pct: number; compressed_pct: number } | undefined,
  swap: { used_mb: number } | undefined,
  t: Thresholds,
): MemoryPressure {
  if (!vm) return 'warn'
  const free = vm.free_pct
  const swapUsedMb = swap?.used_mb ?? 0
  if (free < t.mem_free_critical_pct) return 'critical'
  if (swapUsedMb > 4096) return 'critical'
  if (free < t.mem_free_warn_pct) return 'warn'
  if (swapUsedMb > 1024) return 'warn'
  if (vm.compressed_pct > 40) return 'warn'
  return 'normal'
}

export function computeVerdict(args: {
  load1_per_core: number
  pressure: MemoryPressure
  swap_delta_mb: number | undefined
  free_disk_gb: number | undefined
  running_total_gb: number
  ram_gb: number
  t: Thresholds
}): { state: Verdict; reasons: string[] } {
  const { load1_per_core, pressure, swap_delta_mb, free_disk_gb, running_total_gb, ram_gb, t } = args
  const reasons: string[] = []
  let state: Verdict = 'quiet'

  const rank: Record<Verdict, number> = { quiet: 0, benchmark: 1, unsafe: 2 }
  const escalate = (next: Verdict, reason: string) => {
    reasons.push(reason)
    if (rank[next] > rank[state]) state = next
  }

  if (load1_per_core >= t.load_critical_ratio) {
    escalate('unsafe', `load1/core ${load1_per_core.toFixed(2)} >= ${t.load_critical_ratio}`)
  } else if (load1_per_core >= t.load_high_ratio) {
    escalate('benchmark', `load1/core ${load1_per_core.toFixed(2)} >= ${t.load_high_ratio}`)
  }

  if (pressure === 'critical') {
    escalate('unsafe', 'memory pressure critical')
  } else if (pressure === 'warn') {
    escalate('benchmark', 'memory pressure warn')
  }

  if (swap_delta_mb !== undefined && swap_delta_mb > t.max_swap_delta_mb) {
    escalate('unsafe', `swap grew ${swap_delta_mb.toFixed(0)} MB during sample`)
  } else if (swap_delta_mb !== undefined && swap_delta_mb > t.max_swap_delta_mb / 2) {
    escalate('benchmark', `swap grew ${swap_delta_mb.toFixed(0)} MB during sample`)
  }

  if (free_disk_gb !== undefined) {
    if (free_disk_gb < t.min_free_disk_gb / 2) {
      escalate('unsafe', `free disk ${free_disk_gb.toFixed(1)} GB below half of ${t.min_free_disk_gb} GB reserve`)
    } else if (free_disk_gb < t.min_free_disk_gb) {
      escalate('benchmark', `free disk ${free_disk_gb.toFixed(1)} GB < ${t.min_free_disk_gb} GB reserve`)
    }
  }

  if (ram_gb > 0 && running_total_gb > 0) {
    const ratio = running_total_gb / ram_gb
    if (ratio >= t.running_model_ram_critical_ratio) {
      escalate('unsafe', `running models claim ${running_total_gb.toFixed(1)} GB (>= ${(t.running_model_ram_critical_ratio * 100).toFixed(0)}% of RAM)`)
    } else if (ratio >= t.running_model_ram_warn_ratio) {
      escalate('benchmark', `running models claim ${running_total_gb.toFixed(1)} GB (>= ${(t.running_model_ram_warn_ratio * 100).toFixed(0)}% of RAM)`)
    }
  }

  if (reasons.length === 0) reasons.push('all thresholds nominal')
  return { state, reasons }
}

/** Build a full snapshot from a Probe. Public entry-point for the CLI. */
export async function inspect(probe: Probe, t: Thresholds = DEFAULT_THRESHOLDS, opts?: { swapSampleMs?: number }): Promise<MachineSnapshot> {
  const swapSampleMs = opts?.swapSampleMs ?? 10_000
  const hardware = probe.hardware()
  const [l1, l5, l15] = probe.loadAvg()
  const vm = probe.vmStat()
  const swap0 = probe.swapUsage()

  if (swapSampleMs > 0) probe.onSampleStart?.(swapSampleMs)
  const swap1 = await probe.swapUsageAfterDelay(swapSampleMs)

  const free_disk_gb = probe.freeDiskGB()
  const installed = probe.ollamaList()
  const running = probe.ollamaPs()

  // Canonical pressure first, vm_stat-based fallback only if unavailable.
  const sysctlPressure = probe.pressureSysctl()
  const pressure: MemoryPressure = sysctlPressure ?? computeMemoryPressureFallback(vm, swap0, t)
  const pressure_source: 'sysctl' | 'vm_stat' | 'unavailable' =
    sysctlPressure ? 'sysctl' : (vm ? 'vm_stat' : 'unavailable')

  const swap_delta_mb = (swap0 && swap1)
    ? +(swap1.used_mb - swap0.used_mb).toFixed(1)
    : undefined

  const load1_per_core = hardware.cpu_cores > 0 ? l1 / hardware.cpu_cores : l1

  const installed_total_gb = (installed ?? []).reduce((acc, m) => acc + m.size_bytes / (1024 ** 3), 0)
  const running_total_gb = (running ?? []).reduce((acc, m) => acc + m.size_bytes / (1024 ** 3), 0)

  const verdict = computeVerdict({
    load1_per_core,
    pressure,
    swap_delta_mb,
    free_disk_gb,
    running_total_gb,
    ram_gb: hardware.ram_gb,
    t,
  })

  return {
    ts: new Date().toISOString(),
    hardware,
    load: {
      load1: l1,
      load5: l5,
      load15: l15,
      load1_per_core: +load1_per_core.toFixed(3),
    },
    memory: {
      free_pct: vm?.free_pct ?? 0,
      compressed_pct: vm?.compressed_pct ?? 0,
      wired_pct: vm?.wired_pct ?? 0,
      pressure,
      pressure_source,
    },
    swap: {
      total_mb: swap0?.total_mb ?? 0,
      used_mb: swap0?.used_mb ?? 0,
      delta_mb_over_sample: swap_delta_mb,
      sample_ms: swapSampleMs,
    },
    disk: {
      free_gb: free_disk_gb ?? 0,
      min_reserve_gb: t.min_free_disk_gb,
    },
    ollama: {
      available: installed !== undefined,
      installed: installed ?? [],
      running: running ?? [],
      installed_total_gb: +installed_total_gb.toFixed(1),
      running_total_gb: +running_total_gb.toFixed(1),
    },
    verdict,
  }
}

// ---- Real probe (live system) ----------------------------------------------

function safe<T>(fn: () => T): T | undefined {
  try { return fn() } catch { return undefined }
}

function parseVmStat(out: string): { free_pct: number; compressed_pct: number; wired_pct: number } | undefined {
  // Display-only percentages: the verdict's `pressure` comes from
  // kern.memorystatus_vm_pressure_level (canonical macOS signal), not these
  // numbers. On macOS, "Pages stored in compressor" represents pages that
  // hold compressed copies of anonymous memory — they are physical pages
  // resident in the compressor pool, not counted in active/inactive. So the
  // denominator includes all six classes and the resulting percentages sum
  // to at most 100%.
  const pageSizeMatch = out.match(/page size of (\d+) bytes/)
  if (!pageSizeMatch) return undefined
  const pick = (label: string): number | undefined => {
    const m = out.match(new RegExp(`${label}:\\s+(\\d+)`))
    return m ? Number(m[1]) : undefined
  }
  const free = pick('Pages free')
  const active = pick('Pages active')
  const inactive = pick('Pages inactive')
  const speculative = pick('Pages speculative') ?? 0
  const wired = pick('Pages wired down')
  const compressed = pick('Pages stored in compressor') ?? 0
  if (free === undefined || active === undefined || inactive === undefined || wired === undefined) return undefined
  const total = free + active + inactive + speculative + wired + compressed
  if (total === 0) return undefined
  return {
    free_pct: +((free + speculative) / total * 100).toFixed(1),
    compressed_pct: +(compressed / total * 100).toFixed(1),
    wired_pct: +(wired / total * 100).toFixed(1),
  }
}

function parseSwapusage(out: string): { total_mb: number; used_mb: number } | undefined {
  const m = out.match(/total = ([\d.]+)M\s+used = ([\d.]+)M/)
  if (!m) return undefined
  return { total_mb: Number(m[1]), used_mb: Number(m[2]) }
}

function sizeStringToBytes(s: string): number {
  // Tolerates "4.7 GB", "4.7GB", "470 MB", etc.
  const m = s.match(/([\d.]+)\s*(GB|MB|KB|B)/i)
  if (!m) return 0
  const n = Number(m[1])
  const unit = m[2].toUpperCase()
  const mult = unit === 'GB' ? 1024 ** 3 : unit === 'MB' ? 1024 ** 2 : unit === 'KB' ? 1024 : 1
  return n * mult
}

/**
 * Parse a fixed-width table (used for both `ollama list` and `ollama ps`).
 * Returns one record per data row keyed by header column.
 *
 * We can't split on whitespace alone — `ollama ps`'s PROCESSOR column contains
 * strings like "100% GPU" with internal spaces. Instead we record the column
 * start positions from the header row and slice each data line by position.
 */
function parseFixedWidthTable(out: string): Array<Record<string, string>> {
  const lines = out.split('\n').filter(l => l.length > 0)
  if (lines.length < 2) return []
  const header = lines[0]
  const cols: Array<{ name: string; start: number; end: number }> = []
  const tokens = [...header.matchAll(/\S+/g)]
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    const start = tok.index ?? 0
    const next = tokens[i + 1]
    const end = next ? (next.index ?? header.length) : header.length
    cols.push({ name: tok[0], start, end })
  }
  const rows: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const row: Record<string, string> = {}
    for (const c of cols) {
      row[c.name] = line.slice(c.start, c.end === header.length ? line.length : c.end).trim()
    }
    rows.push(row)
  }
  return rows
}

function parseOllamaList(out: string): OllamaModel[] {
  return parseFixedWidthTable(out).map(r => ({
    name: r['NAME'] ?? '',
    size_bytes: sizeStringToBytes(r['SIZE'] ?? ''),
    modified: r['MODIFIED'] || undefined,
  })).filter(m => m.name.length > 0)
}

function parseOllamaPs(out: string): OllamaRunning[] {
  return parseFixedWidthTable(out).map(r => ({
    name: r['NAME'] ?? '',
    size_bytes: sizeStringToBytes(r['SIZE'] ?? ''),
    context: r['CONTEXT'] ? Number(r['CONTEXT']) || undefined : undefined,
    processor: r['PROCESSOR'] || undefined,
  })).filter(m => m.name.length > 0)
}

function parsePressureLevel(out: string): MemoryPressure | undefined {
  const m = out.match(/(\d+)/)
  if (!m) return undefined
  const n = Number(m[1])
  if (n === 0) return 'normal'
  if (n === 1) return 'warn'
  if (n >= 2) return 'critical'
  return undefined
}

export function createRealProbe(): Probe {
  return {
    loadAvg: () => os.loadavg() as [number, number, number],

    pressureSysctl: () => safe(() => {
      const out = execSync('sysctl -n kern.memorystatus_vm_pressure_level', { encoding: 'utf-8', timeout: 1500 })
      return parsePressureLevel(out)
    }),

    vmStat: () => safe(() => {
      const out = execSync('vm_stat', { encoding: 'utf-8', timeout: 2000 })
      return parseVmStat(out)
    }),

    swapUsage: () => safe(() => {
      const out = execSync('sysctl -n vm.swapusage', { encoding: 'utf-8', timeout: 2000 })
      return parseSwapusage(out)
    }),

    swapUsageAfterDelay: async (delayMs) => {
      await new Promise(r => setTimeout(r, delayMs))
      return safe(() => {
        const out = execSync('sysctl -n vm.swapusage', { encoding: 'utf-8', timeout: 2000 })
        return parseSwapusage(out)
      })
    },

    freeDiskGB: () => safe(() => {
      // -P is POSIX format — single-line per FS, never wraps even on long
      // device names like /dev/disk3s1s1. Columns: 1024-blocks, Used, Available.
      const out = execSync('df -k -P /', { encoding: 'utf-8', timeout: 2000 })
      const line = out.split('\n')[1]
      if (!line) return undefined as unknown as number
      const parts = line.trim().split(/\s+/)
      const availableKb = Number(parts[3])
      if (!Number.isFinite(availableKb)) return undefined as unknown as number
      return +(availableKb / (1024 ** 2)).toFixed(1)
    }),

    ollamaList: () => safe(() => {
      const out = execSync('ollama list', { encoding: 'utf-8', timeout: 3000 })
      return parseOllamaList(out)
    }),

    ollamaPs: () => safe(() => {
      const out = execSync('ollama ps', { encoding: 'utf-8', timeout: 3000 })
      return parseOllamaPs(out)
    }),

    hardware: () => {
      const platform = os.platform()
      const cpuCores = os.cpus().length
      const ramGB = Math.round(os.totalmem() / (1024 ** 3))
      let cpu = os.cpus()[0]?.model || 'Unknown'
      let osVersion = os.release()
      let appleSilicon = false
      if (platform === 'darwin') {
        try { cpu = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf-8' }).trim() || cpu } catch {}
        try { osVersion = execSync('sw_vers -productVersion', { encoding: 'utf-8' }).trim() || osVersion } catch {}
        try { appleSilicon = execSync('sysctl -n hw.optional.arm64', { encoding: 'utf-8' }).trim() === '1' } catch {}
      }
      return {
        cpu,
        cpu_cores: cpuCores,
        cpu_arch: os.arch(),
        apple_silicon: appleSilicon,
        unified_memory: appleSilicon,
        ram_gb: ramGB,
        os: platform === 'darwin' ? 'macOS' : platform,
        os_version: osVersion,
      }
    },
  }
}

/**
 * Guard rail for `verdict machine inspect`. Phase 1 of this command is macOS
 * only — Linux/Windows return a half-baked snapshot today, which is worse
 * than refusing. Tests bypass this by using a fake probe.
 */
export function assertSupportedPlatform(): void {
  if (os.platform() !== 'darwin') {
    throw new Error(`'verdict machine inspect' currently supports macOS only (got ${os.platform()}). Linux support is tracked for a later phase.`)
  }
}

// Exposed for tests.
export const _internals = { parseVmStat, parseSwapusage, parseOllamaList, parseOllamaPs, parsePressureLevel, parseFixedWidthTable, sizeStringToBytes }
