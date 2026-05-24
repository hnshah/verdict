/**
 * Resource guard — gates a run on live machine state.
 *
 * Compares a `MachineSnapshot` (from `verdict machine inspect`) against the
 * `run.resource_guard` config block and reports whether it's safe to start
 * (`gateStart`) or to keep going between cases (`gateBetweenCases`).
 *
 * Pure logic — no subprocesses. Callers supply a probe / snapshot. Designed
 * so the runner can paste the result straight into its log without further
 * formatting.
 */

import type { Verdict, MemoryPressure, MachineSnapshot, Thresholds } from './machine.js'
import { inspect, DEFAULT_THRESHOLDS, type Probe } from './machine.js'

export interface ResourceGuardConfig {
  enabled: boolean
  on_fail: 'abort' | 'warn'
  max_concurrency?: number
  min_free_disk_gb: number
  max_memory_pressure: MemoryPressure
  max_swap_delta_mb: number
  /** When 0, the swap-delta check is skipped entirely. */
  swap_sample_ms: number
  mid_run_check_seconds: number
}

export interface GuardResult {
  ok: boolean
  /** Verdict on the current snapshot (mirrors `MachineSnapshot.verdict.state`). */
  verdict: Verdict
  /** Per-rule breakdown. Each entry is a human-readable status string. */
  checks: GuardCheck[]
  /** Concatenation of failing-check reasons, ready for log/error output. */
  reason?: string
}

export interface GuardCheck {
  rule: 'memory_pressure' | 'free_disk' | 'swap_delta' | 'concurrency'
  ok: boolean
  /**
   * `true` when the rule was deliberately not evaluated (e.g. swap-delta
   * with `swap_sample_ms: 0`, or free-disk when the probe returned 0 GB).
   * Skipped rules are reported in `checks` but excluded from the pass/fail
   * aggregate.
   */
  skipped?: boolean
  detail: string
}

const PRESSURE_RANK: Record<MemoryPressure, number> = { normal: 0, warn: 1, critical: 2 }

/**
 * Evaluate the guard against a snapshot. Pure, no I/O — pair with `inspect()`
 * to get the snapshot, or build a `MachineSnapshot` shape in tests.
 *
 * `configuredConcurrency` is what `config.run.concurrency` resolves to, so
 * the guard can flag when the user set 4 but `max_concurrency: 1`.
 */
export function evaluateGuard(
  snap: MachineSnapshot,
  cfg: ResourceGuardConfig,
  configuredConcurrency?: number,
): GuardResult {
  const checks: GuardCheck[] = []

  // 1. Memory pressure. Field name reads as "the max pressure I allow." A
  //    machine *at* the threshold passes; anything worse fails.
  const ok_pressure = PRESSURE_RANK[snap.memory.pressure] <= PRESSURE_RANK[cfg.max_memory_pressure]
  checks.push({
    rule: 'memory_pressure',
    ok: ok_pressure,
    detail: ok_pressure
      ? `pressure ${snap.memory.pressure} within max_memory_pressure=${cfg.max_memory_pressure}`
      : `pressure ${snap.memory.pressure} exceeds max_memory_pressure=${cfg.max_memory_pressure}`,
  })

  // 2. Free disk. Snapshot may have `free_gb: 0` when the probe failed;
  //    treat that as "skip" rather than "fail" — we'd rather not block a
  //    run on missing telemetry.
  if (snap.disk.free_gb > 0) {
    const ok_disk = snap.disk.free_gb >= cfg.min_free_disk_gb
    checks.push({
      rule: 'free_disk',
      ok: ok_disk,
      detail: ok_disk
        ? `free disk ${snap.disk.free_gb.toFixed(1)} GB >= ${cfg.min_free_disk_gb} GB`
        : `free disk ${snap.disk.free_gb.toFixed(1)} GB < ${cfg.min_free_disk_gb} GB reserve`,
    })
  } else {
    checks.push({
      rule: 'free_disk',
      ok: true,
      skipped: true,
      detail: 'free disk probe returned 0 GB — skipped',
    })
  }

  // 3. Swap delta. Only meaningful when `swap_sample_ms > 0`; otherwise
  //    `swap0` and `swap1` are read back-to-back and the delta is always
  //    ~0. We report the rule as skipped in that case so users don't think
  //    a 200 MB threshold is gating anything when it isn't.
  if (cfg.swap_sample_ms <= 0) {
    checks.push({
      rule: 'swap_delta',
      ok: true,
      skipped: true,
      detail: `swap_sample_ms=0 — swap-delta check disabled`,
    })
  } else if (snap.swap.delta_mb_over_sample === undefined) {
    checks.push({
      rule: 'swap_delta',
      ok: true,
      skipped: true,
      detail: 'swap delta unavailable — skipped',
    })
  } else {
    const ok_swap = snap.swap.delta_mb_over_sample <= cfg.max_swap_delta_mb
    checks.push({
      rule: 'swap_delta',
      ok: ok_swap,
      detail: ok_swap
        ? `swap delta ${snap.swap.delta_mb_over_sample.toFixed(0)} MB over ${Math.round(snap.swap.sample_ms / 1000)}s <= ${cfg.max_swap_delta_mb} MB`
        : `swap grew ${snap.swap.delta_mb_over_sample.toFixed(0)} MB during ${Math.round(snap.swap.sample_ms / 1000)}s sample (max ${cfg.max_swap_delta_mb})`,
    })
  }

  // 4. Concurrency. Surface the conflict but don't fail the gate — the runner
  //    decides whether to clamp or warn.
  if (cfg.max_concurrency !== undefined && configuredConcurrency !== undefined) {
    const ok_conc = configuredConcurrency <= cfg.max_concurrency
    checks.push({
      rule: 'concurrency',
      ok: ok_conc,
      detail: ok_conc
        ? `concurrency ${configuredConcurrency} <= ${cfg.max_concurrency}`
        : `concurrency ${configuredConcurrency} exceeds guard limit ${cfg.max_concurrency} (will be clamped)`,
    })
  }

  const failing = checks.filter(c => !c.ok && !c.skipped && c.rule !== 'concurrency')
  const ok = failing.length === 0
  return {
    ok,
    verdict: snap.verdict.state,
    checks,
    reason: ok ? undefined : failing.map(c => c.detail).join('; '),
  }
}

/**
 * Resolve the effective concurrency a run should use: the config's
 * `concurrency` clamped to `resource_guard.max_concurrency` (if set).
 */
export function effectiveConcurrency(configured: number, cfg: ResourceGuardConfig | undefined): number {
  if (!cfg || !cfg.enabled || cfg.max_concurrency === undefined) return configured
  return Math.min(configured, cfg.max_concurrency)
}

/**
 * Detect a guard config that has been silently disabled — `enabled: false`
 * but with non-default thresholds set. Returns a message if the config will
 * surprise the user, otherwise `undefined`.
 */
export function describeDisabledMisconfig(cfg: ResourceGuardConfig | undefined): string | undefined {
  if (!cfg || cfg.enabled) return undefined
  const hints: string[] = []
  if (cfg.max_concurrency !== undefined) hints.push(`max_concurrency=${cfg.max_concurrency}`)
  if (cfg.min_free_disk_gb !== 25) hints.push(`min_free_disk_gb=${cfg.min_free_disk_gb}`)
  if (cfg.max_memory_pressure !== 'warn') hints.push(`max_memory_pressure=${cfg.max_memory_pressure}`)
  if (cfg.max_swap_delta_mb !== 200) hints.push(`max_swap_delta_mb=${cfg.max_swap_delta_mb}`)
  if (cfg.swap_sample_ms !== 0) hints.push(`swap_sample_ms=${cfg.swap_sample_ms}`)
  if (cfg.mid_run_check_seconds !== 0) hints.push(`mid_run_check_seconds=${cfg.mid_run_check_seconds}`)
  if (hints.length === 0) return undefined
  return `resource_guard is disabled (enabled: false) but you set ${hints.join(', ')} — these settings will be ignored`
}

/**
 * Run the guard against a live probe. Convenience wrapper for the runner so
 * it doesn't need to know about `inspect()` and `Thresholds` directly.
 *
 * The swap-sample window is taken from `cfg.swap_sample_ms`. When 0, the
 * swap-delta check is reported as skipped.
 */
export async function evaluateGuardLive(
  probe: Probe,
  cfg: ResourceGuardConfig,
  opts: { configuredConcurrency?: number; thresholds?: Thresholds } = {},
): Promise<{ snapshot: MachineSnapshot; guard: GuardResult }> {
  const snapshot = await inspect(probe, opts.thresholds ?? DEFAULT_THRESHOLDS, { swapSampleMs: cfg.swap_sample_ms })
  const guard = evaluateGuard(snapshot, cfg, opts.configuredConcurrency)
  return { snapshot, guard }
}
