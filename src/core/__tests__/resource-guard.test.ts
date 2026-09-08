import { describe, expect, it } from 'vitest'
import {
  evaluateGuard,
  effectiveConcurrency,
  describeDisabledMisconfig,
  type ResourceGuardConfig,
} from '../resource-guard.js'
import type { MachineSnapshot } from '../machine.js'

const baseConfig: ResourceGuardConfig = {
  enabled: true,
  on_fail: 'abort',
  min_free_disk_gb: 25,
  max_memory_pressure: 'warn',
  max_swap_delta_mb: 200,
  swap_sample_ms: 0,
  mid_run_check_seconds: 0,
}

function snapshot(overrides: Partial<MachineSnapshot> = {}): MachineSnapshot {
  return {
    ts: '2026-05-24T18:00:00.000Z',
    hardware: {
      cpu: 'Apple M4 Pro', cpu_cores: 12, cpu_arch: 'arm64',
      apple_silicon: true, unified_memory: true, ram_gb: 24,
      os: 'macOS', os_version: '15.0',
    },
    load: { load1: 1, load5: 1, load15: 1, load1_per_core: 0.083 },
    memory: { free_pct: 30, compressed_pct: 10, wired_pct: 20, pressure: 'normal', pressure_source: 'sysctl' },
    swap: { total_mb: 3072, used_mb: 100, delta_mb_over_sample: 5, sample_ms: 0 },
    disk: { free_gb: 50, min_reserve_gb: 25 },
    ollama: { available: true, installed: [], running: [], installed_total_gb: 0, running_total_gb: 0 },
    verdict: { state: 'quiet', reasons: ['nominal'] },
    ...overrides,
  }
}

describe('evaluateGuard', () => {
  it('passes a nominal snapshot', () => {
    const r = evaluateGuard(snapshot(), baseConfig)
    expect(r.ok).toBe(true)
    expect(r.reason).toBeUndefined()
  })

  it('fails when memory pressure exceeds max_memory_pressure', () => {
    const r = evaluateGuard(snapshot({
      memory: { free_pct: 5, compressed_pct: 50, wired_pct: 20, pressure: 'critical', pressure_source: 'sysctl' },
    }), baseConfig)
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/pressure critical/)
  })

  it('passes when pressure equals max_memory_pressure (warn === warn)', () => {
    const r = evaluateGuard(snapshot({
      memory: { free_pct: 8, compressed_pct: 30, wired_pct: 20, pressure: 'warn', pressure_source: 'sysctl' },
    }), baseConfig)
    expect(r.ok).toBe(true)
  })

  it('tightening max_memory_pressure to normal rejects a machine in warn', () => {
    const r = evaluateGuard(snapshot({
      memory: { free_pct: 8, compressed_pct: 30, wired_pct: 20, pressure: 'warn', pressure_source: 'sysctl' },
    }), { ...baseConfig, max_memory_pressure: 'normal' })
    expect(r.ok).toBe(false)
  })

  it('fails when free disk is below the reserve', () => {
    const r = evaluateGuard(snapshot({
      disk: { free_gb: 20, min_reserve_gb: 25 },
    }), baseConfig)
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/free disk/)
  })

  it('skips the disk check when the probe reported 0 GB free', () => {
    const r = evaluateGuard(snapshot({
      disk: { free_gb: 0, min_reserve_gb: 25 },
    }), baseConfig)
    expect(r.ok).toBe(true)
    const disk = r.checks.find(c => c.rule === 'free_disk')
    expect(disk?.skipped).toBe(true)
  })

  it('skips the swap-delta check when swap_sample_ms is 0', () => {
    const r = evaluateGuard(snapshot({
      swap: { total_mb: 3072, used_mb: 100, delta_mb_over_sample: 9999, sample_ms: 0 },
    }), { ...baseConfig, swap_sample_ms: 0 })
    const swap = r.checks.find(c => c.rule === 'swap_delta')
    expect(swap?.skipped).toBe(true)
    expect(r.ok).toBe(true) // skipped, so doesn't fail
  })

  it('evaluates swap-delta when swap_sample_ms > 0 and snapshot has a delta', () => {
    const r = evaluateGuard(snapshot({
      swap: { total_mb: 3072, used_mb: 100, delta_mb_over_sample: 500, sample_ms: 2000 },
    }), { ...baseConfig, swap_sample_ms: 2000 })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/swap grew/)
  })

  it('skips swap-delta when sample window > 0 but delta is unavailable from snapshot', () => {
    const r = evaluateGuard(snapshot({
      swap: { total_mb: 3072, used_mb: 100, delta_mb_over_sample: undefined, sample_ms: 2000 },
    }), { ...baseConfig, swap_sample_ms: 2000 })
    const swap = r.checks.find(c => c.rule === 'swap_delta')
    expect(swap?.skipped).toBe(true)
  })

  it('surfaces a concurrency conflict but does not fail the gate', () => {
    const r = evaluateGuard(snapshot(), {
      ...baseConfig,
      max_concurrency: 1,
    }, /* configuredConcurrency */ 4)
    expect(r.ok).toBe(true)
    const conc = r.checks.find(c => c.rule === 'concurrency')
    expect(conc).toBeDefined()
    expect(conc!.ok).toBe(false)
    expect(conc!.detail).toMatch(/will be clamped/)
  })

  it('reports multiple failures concatenated in reason', () => {
    const r = evaluateGuard(snapshot({
      memory: { free_pct: 2, compressed_pct: 60, wired_pct: 20, pressure: 'critical', pressure_source: 'sysctl' },
      disk: { free_gb: 10, min_reserve_gb: 25 },
      swap: { total_mb: 3072, used_mb: 100, delta_mb_over_sample: 800, sample_ms: 2000 },
    }), { ...baseConfig, swap_sample_ms: 2000 })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/pressure critical/)
    expect(r.reason).toMatch(/free disk/)
    expect(r.reason).toMatch(/swap grew/)
  })

  it('includes verdict from the snapshot in the result', () => {
    const r = evaluateGuard(snapshot({ verdict: { state: 'unsafe', reasons: ['x'] } }), baseConfig)
    expect(r.verdict).toBe('unsafe')
  })
})

describe('effectiveConcurrency', () => {
  it('returns the configured value when the guard is disabled', () => {
    expect(effectiveConcurrency(4, undefined)).toBe(4)
    expect(effectiveConcurrency(4, { ...baseConfig, enabled: false })).toBe(4)
  })

  it('returns the configured value when no max_concurrency is set', () => {
    expect(effectiveConcurrency(4, baseConfig)).toBe(4)
  })

  it('clamps to max_concurrency when configured concurrency is higher', () => {
    expect(effectiveConcurrency(4, { ...baseConfig, max_concurrency: 1 })).toBe(1)
  })

  it('does not raise concurrency when configured is lower than max_concurrency', () => {
    expect(effectiveConcurrency(1, { ...baseConfig, max_concurrency: 4 })).toBe(1)
  })
})

describe('describeDisabledMisconfig', () => {
  it('returns undefined when the guard is enabled', () => {
    expect(describeDisabledMisconfig({ ...baseConfig, max_concurrency: 1 })).toBeUndefined()
  })

  it('returns undefined when disabled and no non-default fields set', () => {
    expect(describeDisabledMisconfig({ ...baseConfig, enabled: false })).toBeUndefined()
  })

  it('warns when disabled but the user set thresholds that will be ignored', () => {
    const msg = describeDisabledMisconfig({
      ...baseConfig,
      enabled: false,
      max_concurrency: 1,
      min_free_disk_gb: 50,
    })
    expect(msg).toBeDefined()
    expect(msg).toMatch(/max_concurrency=1/)
    expect(msg).toMatch(/min_free_disk_gb=50/)
    expect(msg).toMatch(/ignored/)
  })
})
