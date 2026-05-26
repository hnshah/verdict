import { describe, expect, it } from 'vitest'
import {
  computeMemoryPressureFallback,
  computeVerdict,
  inspect,
  DEFAULT_THRESHOLDS,
  _internals,
  type Probe,
} from '../machine.js'

const { parseVmStat, parseSwapusage, parseOllamaList, parseOllamaPs, parsePressureLevel, parseFixedWidthTable, sizeStringToBytes } = _internals

describe('parseVmStat', () => {
  it('extracts free/compressed/wired percentages with resident-only denominator', () => {
    const sample = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               13390.
Pages active:                            212848.
Pages inactive:                          211560.
Pages speculative:                          638.
Pages throttled:                              0.
Pages wired down:                        548260.
Pages purgeable:                           5321.
"Translation faults":                1848998619.
Pages copy-on-write:                 1125438525.
Pages zero filled:                    610233789.
Pages reactivated:                     30098147.
Pages purged:                           8163814.
File-backed pages:                       135240.
Anonymous pages:                         289806.
Pages stored in compressor:             1397820.`
    const out = parseVmStat(sample)
    expect(out).toBeDefined()
    expect(out!.free_pct).toBeGreaterThan(0)
    expect(out!.wired_pct).toBeGreaterThan(0)
    // Six-class denominator: percentages must each be in [0, 100].
    expect(out!.free_pct).toBeLessThanOrEqual(100)
    expect(out!.compressed_pct).toBeLessThanOrEqual(100)
    expect(out!.wired_pct).toBeLessThanOrEqual(100)
    // And they cannot exceed 100 in aggregate.
    expect(out!.free_pct + out!.compressed_pct + out!.wired_pct).toBeLessThanOrEqual(100)
  })

  it('returns undefined on malformed input', () => {
    expect(parseVmStat('not a vm_stat output')).toBeUndefined()
  })

  it('returns undefined when required page-class lines are missing', () => {
    expect(parseVmStat('Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 100.')).toBeUndefined()
  })
})

describe('parseSwapusage', () => {
  it('parses total/used from sysctl output', () => {
    expect(parseSwapusage('total = 3072.00M  used = 2334.19M  free = 737.81M  (encrypted)')).toEqual({
      total_mb: 3072,
      used_mb: 2334.19,
    })
  })

  it('returns undefined on missing fields', () => {
    expect(parseSwapusage('garbage')).toBeUndefined()
  })
})

describe('parsePressureLevel', () => {
  it('maps 0/1/2+ to normal/warn/critical', () => {
    expect(parsePressureLevel('0')).toBe('normal')
    expect(parsePressureLevel('1')).toBe('warn')
    expect(parsePressureLevel('2')).toBe('critical')
    expect(parsePressureLevel('4')).toBe('critical')
  })

  it('returns undefined on non-numeric input', () => {
    expect(parsePressureLevel('garbage')).toBeUndefined()
  })
})

describe('parseFixedWidthTable + size parsing', () => {
  it('preserves spaces inside columns (e.g. "100% GPU")', () => {
    const out = `NAME              ID      SIZE    PROCESSOR      CONTEXT    UNTIL
qwen2.5:7b        abc123  5.0 GB  100% GPU       4096       4 minutes from now`
    const rows = parseFixedWidthTable(out)
    expect(rows).toHaveLength(1)
    expect(rows[0]['NAME']).toBe('qwen2.5:7b')
    expect(rows[0]['SIZE']).toBe('5.0 GB')
    expect(rows[0]['PROCESSOR']).toBe('100% GPU')
    expect(rows[0]['CONTEXT']).toBe('4096')
  })

  it('sizeStringToBytes handles GB/MB/KB', () => {
    expect(sizeStringToBytes('4.7 GB')).toBeCloseTo(4.7 * 1024 ** 3, -3)
    expect(sizeStringToBytes('250 MB')).toBeCloseTo(250 * 1024 ** 2, -3)
    expect(sizeStringToBytes('  9.3GB ')).toBeCloseTo(9.3 * 1024 ** 3, -3)
    expect(sizeStringToBytes('garbage')).toBe(0)
  })
})

describe('parseOllamaList', () => {
  it('parses rows from a realistic ollama list output', () => {
    const out = `NAME                       ID              SIZE      MODIFIED
qwen2.5:7b                 845dbda0ea48    4.7 GB    3 days ago
llama3.2:3b                a80c4f17acd5    2.0 GB    3 days ago`
    const rows = parseOllamaList(out)
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('qwen2.5:7b')
    expect(rows[0].size_bytes).toBeCloseTo(4.7 * 1024 ** 3, -6)
    expect(rows[0].modified).toBe('3 days ago')
  })
})

describe('parseOllamaPs', () => {
  it('extracts SIZE and CONTEXT correctly even when PROCESSOR has spaces', () => {
    const out = `NAME              ID      SIZE    PROCESSOR      CONTEXT    UNTIL
qwen2.5:7b        abc123  5.0 GB  100% GPU       4096       4 minutes from now
gemma3:12b        def456  8.1 GB  50% CPU/GPU    8192       1 minute from now`
    const rows = parseOllamaPs(out)
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('qwen2.5:7b')
    expect(rows[0].size_bytes).toBeCloseTo(5.0 * 1024 ** 3, -3)
    expect(rows[0].processor).toBe('100% GPU')
    expect(rows[0].context).toBe(4096)
    expect(rows[1].processor).toBe('50% CPU/GPU')
  })

  it('returns no rows for an empty `ollama ps` (header only)', () => {
    expect(parseOllamaPs('NAME    ID    SIZE    PROCESSOR    CONTEXT    UNTIL')).toEqual([])
  })
})

describe('computeMemoryPressureFallback', () => {
  it('returns normal when free is high and swap is small', () => {
    expect(computeMemoryPressureFallback({ free_pct: 50, compressed_pct: 5 }, { used_mb: 0 }, DEFAULT_THRESHOLDS)).toBe('normal')
  })

  it('returns critical when free is below critical threshold', () => {
    expect(computeMemoryPressureFallback({ free_pct: 3, compressed_pct: 0 }, { used_mb: 0 }, DEFAULT_THRESHOLDS)).toBe('critical')
  })

  it('returns critical when swap usage exceeds 4 GB', () => {
    expect(computeMemoryPressureFallback({ free_pct: 30, compressed_pct: 0 }, { used_mb: 5000 }, DEFAULT_THRESHOLDS)).toBe('critical')
  })

  it('returns warn on heavy compression', () => {
    expect(computeMemoryPressureFallback({ free_pct: 50, compressed_pct: 45 }, { used_mb: 0 }, DEFAULT_THRESHOLDS)).toBe('warn')
  })

  it('returns warn when vm stat is unavailable', () => {
    expect(computeMemoryPressureFallback(undefined, undefined, DEFAULT_THRESHOLDS)).toBe('warn')
  })
})

describe('computeVerdict', () => {
  const base = {
    load1_per_core: 0.2,
    pressure: 'normal' as const,
    swap_delta_mb: 0,
    free_disk_gb: 100,
    running_total_gb: 0,
    ram_gb: 24,
    t: DEFAULT_THRESHOLDS,
  }

  it('is quiet when everything is nominal', () => {
    expect(computeVerdict(base).state).toBe('quiet')
  })

  it('escalates to benchmark on high load', () => {
    expect(computeVerdict({ ...base, load1_per_core: 0.8 }).state).toBe('benchmark')
  })

  it('escalates to unsafe on critical load', () => {
    expect(computeVerdict({ ...base, load1_per_core: 1.5 }).state).toBe('unsafe')
  })

  it('escalates to unsafe on critical pressure', () => {
    expect(computeVerdict({ ...base, pressure: 'critical' }).state).toBe('unsafe')
  })

  it('escalates to unsafe on swap growth above threshold', () => {
    expect(computeVerdict({ ...base, swap_delta_mb: 500 }).state).toBe('unsafe')
  })

  it('escalates to benchmark when free disk dips below reserve', () => {
    expect(computeVerdict({ ...base, free_disk_gb: 20 }).state).toBe('benchmark')
  })

  it('escalates to unsafe when free disk is critically low', () => {
    expect(computeVerdict({ ...base, free_disk_gb: 5 }).state).toBe('unsafe')
  })

  it('escalates to benchmark when running models claim >=60% of RAM', () => {
    expect(computeVerdict({ ...base, running_total_gb: 15, ram_gb: 24 }).state).toBe('benchmark')
  })

  it('escalates to unsafe when running models claim >=85% of RAM', () => {
    expect(computeVerdict({ ...base, running_total_gb: 22, ram_gb: 24 }).state).toBe('unsafe')
  })

  it('keeps the worst state across multiple signals', () => {
    const v = computeVerdict({ ...base, load1_per_core: 0.8, pressure: 'critical' })
    expect(v.state).toBe('unsafe')
    expect(v.reasons.length).toBeGreaterThanOrEqual(2)
  })
})

describe('inspect()', () => {
  function fakeProbe(overrides: Partial<Probe> = {}): Probe {
    return {
      loadAvg: () => [0.2, 0.2, 0.2],
      pressureSysctl: () => 'normal',
      vmStat: () => ({ free_pct: 50, compressed_pct: 5, wired_pct: 20 }),
      swapUsage: () => ({ total_mb: 3072, used_mb: 100 }),
      swapUsageAfterDelay: async () => ({ total_mb: 3072, used_mb: 110 }),
      freeDiskGB: () => 100,
      ollamaList: () => [
        { name: 'qwen2.5:7b', size_bytes: 4.7 * 1024 ** 3 },
      ],
      ollamaPs: () => [],
      hardware: () => ({
        cpu: 'Apple M4 Pro',
        cpu_cores: 12,
        cpu_arch: 'arm64',
        apple_silicon: true,
        unified_memory: true,
        ram_gb: 24,
        os: 'macOS',
        os_version: '15.0',
      }),
      ...overrides,
    }
  }

  it('produces a quiet verdict on a nominal machine using sysctl pressure', async () => {
    const snap = await inspect(fakeProbe(), DEFAULT_THRESHOLDS, { swapSampleMs: 0 })
    expect(snap.verdict.state).toBe('quiet')
    expect(snap.memory.pressure_source).toBe('sysctl')
    expect(snap.swap.delta_mb_over_sample).toBe(10)
    expect(snap.swap.sample_ms).toBe(0)
    expect(snap.ollama.available).toBe(true)
  })

  it('produces an unsafe verdict when probes report a thrashing system', async () => {
    const snap = await inspect(
      fakeProbe({
        loadAvg: () => [15, 12, 10],
        pressureSysctl: () => 'critical',
        swapUsage: () => ({ total_mb: 3072, used_mb: 2800 }),
        swapUsageAfterDelay: async () => ({ total_mb: 3072, used_mb: 3300 }),
        freeDiskGB: () => 8,
      }),
      DEFAULT_THRESHOLDS,
      { swapSampleMs: 0 },
    )
    expect(snap.verdict.state).toBe('unsafe')
    expect(snap.verdict.reasons.length).toBeGreaterThan(1)
  })

  it('falls back to vm_stat when sysctl pressure is unavailable', async () => {
    const snap = await inspect(
      fakeProbe({
        pressureSysctl: () => undefined,
        vmStat: () => ({ free_pct: 3, compressed_pct: 0, wired_pct: 30 }),
      }),
      DEFAULT_THRESHOLDS,
      { swapSampleMs: 0 },
    )
    expect(snap.memory.pressure_source).toBe('vm_stat')
    expect(snap.memory.pressure).toBe('critical')
  })

  it('reports pressure_source unavailable when neither sysctl nor vm_stat work', async () => {
    const snap = await inspect(
      fakeProbe({ pressureSysctl: () => undefined, vmStat: () => undefined }),
      DEFAULT_THRESHOLDS,
      { swapSampleMs: 0 },
    )
    expect(snap.memory.pressure_source).toBe('unavailable')
  })

  it('feeds running ollama models into the verdict', async () => {
    const snap = await inspect(
      fakeProbe({
        ollamaPs: () => [
          { name: 'qwen3:32b', size_bytes: 22 * 1024 ** 3, processor: '100% GPU', context: 8192 },
        ],
      }),
      DEFAULT_THRESHOLDS,
      { swapSampleMs: 0 },
    )
    expect(snap.ollama.running_total_gb).toBeCloseTo(22, 1)
    expect(snap.verdict.state).toBe('unsafe')
    expect(snap.verdict.reasons.some(r => r.includes('running models claim'))).toBe(true)
  })

  it('handles missing Ollama gracefully', async () => {
    const snap = await inspect(
      fakeProbe({ ollamaList: () => undefined, ollamaPs: () => undefined }),
      DEFAULT_THRESHOLDS,
      { swapSampleMs: 0 },
    )
    expect(snap.ollama.available).toBe(false)
    expect(snap.ollama.installed).toEqual([])
    expect(snap.ollama.running).toEqual([])
  })

  it('handles missing swap probe (returns undefined delta)', async () => {
    const snap = await inspect(
      fakeProbe({
        swapUsage: () => undefined,
        swapUsageAfterDelay: async () => undefined,
      }),
      DEFAULT_THRESHOLDS,
      { swapSampleMs: 0 },
    )
    expect(snap.swap.delta_mb_over_sample).toBeUndefined()
  })

  it('invokes the onSampleStart hook when the sample duration is > 0', async () => {
    const calls: number[] = []
    await inspect(
      fakeProbe({ onSampleStart: (ms) => calls.push(ms) }),
      DEFAULT_THRESHOLDS,
      { swapSampleMs: 5 },
    )
    expect(calls).toEqual([5])
  })

  it('does not invoke onSampleStart in --fast mode (sample 0)', async () => {
    const calls: number[] = []
    await inspect(
      fakeProbe({ onSampleStart: (ms) => calls.push(ms) }),
      DEFAULT_THRESHOLDS,
      { swapSampleMs: 0 },
    )
    expect(calls).toEqual([])
  })
})
