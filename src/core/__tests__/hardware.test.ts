import { describe, expect, it } from 'vitest'
import { checkFit, estimateRamGB, estimateKvCacheGB, type HardwareInfo } from '../hardware.js'

// Non-Apple Silicon by default so existing tests don't pick up the new
// auto-detected unified-memory reserve. Tests that care about Apple Silicon
// set cpuArch + os explicitly.
const baseHardware: HardwareInfo = {
  cpu: 'Test CPU',
  cpuCores: 8,
  cpuArch: 'x64',
  ram: '32 GB',
  ramGB: 32,
  freeDiskGB: 100,
  os: 'Linux',
  osVersion: '6.0',
}

const appleSiliconHardware: HardwareInfo = {
  ...baseHardware,
  cpu: 'Apple M4 Pro',
  cpuArch: 'arm64',
  os: 'macOS',
  osVersion: '15.0',
}

describe('estimateRamGB', () => {
  it('estimates q4 memory with overhead', () => {
    expect(estimateRamGB(8, 'q4_K_M')).toBe(4.8)
  })

  it('estimates q5 memory with overhead', () => {
    expect(estimateRamGB(8, 'q5_K_M')).toBe(6)
  })

  it('estimates q8 memory with overhead', () => {
    expect(estimateRamGB(8, 'q8_0')).toBe(9.6)
  })

  it('estimates fp16 memory with overhead', () => {
    expect(estimateRamGB(8, 'fp16')).toBe(19.2)
  })
})

describe('estimateKvCacheGB', () => {
  it('is zero at zero context', () => {
    expect(estimateKvCacheGB(7, 0)).toBe(0)
  })

  it('is zero for zero-param models', () => {
    expect(estimateKvCacheGB(0, 8192)).toBe(0)
  })

  it('scales linearly with context (within rounding tolerance)', () => {
    // Use a model size large enough that toFixed(2) rounding doesn't dominate.
    const at8k = estimateKvCacheGB(70, 8192)
    const at32k = estimateKvCacheGB(70, 32768)
    expect(at32k / at8k).toBeCloseTo(4, 0)
  })

  it('grows with model size at fixed context', () => {
    expect(estimateKvCacheGB(14, 8192)).toBeGreaterThan(estimateKvCacheGB(7, 8192))
  })

  it('does not blow up at 70B at 128K (modern GQA assumption)', () => {
    // Real GQA models at this scale need ~10-15 GB KV. A formula that
    // predicted 78 GB would falsely reject every 70B pull at high context.
    expect(estimateKvCacheGB(70, 128_000)).toBeLessThan(20)
  })
})

describe('checkFit', () => {
  it('allows a model that fits comfortably and returns a full details breakdown', () => {
    const fit = checkFit(
      { name: 'qwen2.5:7b', params_b: 7, quant: 'q4_K_M' },
      baseHardware
    )

    expect(fit.fits).toBe(true)
    expect(fit.needs_gb).toBeGreaterThan(0)
    expect(fit.available_gb).toBe(28) // 32 - 4 headroom on non-Apple-Silicon
    expect(fit.details.weights_gb).toBeCloseTo(3.5, 1)        // 7 * 0.5
    expect(fit.details.activation_overhead_gb).toBeCloseTo(0.53, 1) // 3.5 * 0.15
    expect(fit.details.kv_cache_gb).toBeGreaterThan(0)
    expect(fit.details.unified_reserve_gb).toBe(0)            // not Apple Silicon
    expect(fit.details.free_disk_after_pull_gb).toBeDefined()
  })

  it('rejects a model that exceeds available RAM with a decomposed reason', () => {
    const fit = checkFit(
      { name: 'llama3.1:70b', params_b: 70, quant: 'q4_K_M' },
      baseHardware
    )

    expect(fit.fits).toBe(false)
    expect(fit.reason).toContain('weights')
    expect(fit.reason).toContain('kv')
  })

  it('rejects when free disk drops below the reserve after pull', () => {
    // 7B q4 ≈ ~3.7 GB on disk; min reserve 25; free 28 → 24.3 < 25 → reject.
    const fit = checkFit(
      { name: 'qwen2.5:7b', params_b: 7, quant: 'q4_K_M' },
      { ...baseHardware, freeDiskGB: 28 },
      { min_free_disk_gb: 25 },
    )
    expect(fit.fits).toBe(false)
    expect(fit.reason).toMatch(/reserve is 25/)
    expect(fit.details.free_disk_after_pull_gb).toBeLessThan(25)
  })

  it('reserve boundary uses unrounded math (24.95 is still < 25)', () => {
    // Construct a case where rounded free-after-pull == 25.0 but real < 25.
    // 7B q4 on-disk ≈ 7 * 0.5 * 1.05 = 3.675 GB. Free 28.625 → exact 24.95 → rounds to 25.0 but should reject.
    const fit = checkFit(
      { name: 'qwen2.5:7b', params_b: 7, quant: 'q4_K_M' },
      { ...baseHardware, freeDiskGB: 28.625 },
      { min_free_disk_gb: 25 },
    )
    expect(fit.fits).toBe(false)
  })

  it('reports "needs N GB" when the download is bigger than free disk (oversize branch)', () => {
    const fit = checkFit(
      { name: 'qwen2.5:7b', params_b: 7, quant: 'q4_K_M' },
      { ...baseHardware, freeDiskGB: 2 }
    )

    expect(fit.fits).toBe(false)
    expect(fit.reason).toMatch(/needs about/)
    expect(fit.reason).not.toMatch(/reserve is/)
  })

  it('critical pressure tightens headroom (3×) but still allows tiny models on big machines', () => {
    // 1B q4 on a 64 GB machine: weights 0.5 + activations 0.075 + tiny KV.
    // Headroom under critical = 4 * 3 = 12 GB. Available = 52 GB. Easy fit.
    const fit = checkFit(
      { name: 'tiny:1b', params_b: 1, quant: 'q4_K_M' },
      { ...baseHardware, ramGB: 64 },
      { memory_pressure: 'critical' },
    )
    expect(fit.fits).toBe(true)
    expect(fit.details.headroom_gb).toBe(12)
  })

  it('critical pressure rejects a big model that would otherwise just fit', () => {
    // 14B q4: weights 7, activations 1.05, KV ~0.15 → ~8.2 GB.
    // 16 GB machine, headroom 4 default → 12 GB available → fits at normal.
    // Under critical, headroom = 12 → 4 GB available → rejected.
    const normal = checkFit(
      { name: 'mid:14b', params_b: 14, quant: 'q4_K_M' },
      { ...baseHardware, ramGB: 16 },
      { memory_pressure: 'normal' },
    )
    expect(normal.fits).toBe(true)
    const critical = checkFit(
      { name: 'mid:14b', params_b: 14, quant: 'q4_K_M' },
      { ...baseHardware, ramGB: 16 },
      { memory_pressure: 'critical' },
    )
    expect(critical.fits).toBe(false)
    expect(critical.reason).toMatch(/pressure critical/)
  })

  it('warn pressure tightens default headroom but respects caller-supplied headroom_gb', () => {
    const warnDefault = checkFit(
      { name: 'fake', params_b: 7, quant: 'q4_K_M' },
      baseHardware,
      { memory_pressure: 'warn' },
    )
    expect(warnDefault.details.headroom_gb).toBe(6) // 4 * 1.5

    const warnCustom = checkFit(
      { name: 'fake', params_b: 7, quant: 'q4_K_M' },
      baseHardware,
      { memory_pressure: 'warn', headroom_gb: 8 },
    )
    // Caller-supplied 8 is NOT bumped by the pressure multiplier.
    expect(warnCustom.details.headroom_gb).toBe(8)
  })

  it('auto-detects Apple Silicon and adds the unified-memory reserve', () => {
    const fit = checkFit(
      { name: 'qwen2.5:7b', params_b: 7, quant: 'q4_K_M' },
      appleSiliconHardware,
    )
    expect(fit.details.unified_reserve_gb).toBe(2)
    expect(fit.available_gb).toBe(26) // 32 - 4 headroom - 2 unified
  })

  it('respects explicit unified_memory: false on Apple Silicon', () => {
    const fit = checkFit(
      { name: 'qwen2.5:7b', params_b: 7, quant: 'q4_K_M' },
      appleSiliconHardware,
      { unified_memory: false },
    )
    expect(fit.details.unified_reserve_gb).toBe(0)
  })

  it('scales the KV cache budget with the context window', () => {
    const small = checkFit(
      { name: 'qwen2.5:14b', params_b: 14, quant: 'q4_K_M' },
      baseHardware,
      { context_tokens: 4096 },
    )
    const huge = checkFit(
      { name: 'qwen2.5:14b', params_b: 14, quant: 'q4_K_M' },
      baseHardware,
      { context_tokens: 128_000 },
    )
    expect(huge.details.kv_cache_gb).toBeGreaterThan(small.details.kv_cache_gb)
    expect(huge.needs_gb).toBeGreaterThan(small.needs_gb)
  })

  it('rejection details always include the model size breakdown (no zeros)', () => {
    // The previous critical-pressure short-circuit zeroed these out.
    const fit = checkFit(
      { name: 'big:32b', params_b: 32, quant: 'q4_K_M' },
      { ...baseHardware, ramGB: 16 },
      { memory_pressure: 'critical' },
    )
    expect(fit.fits).toBe(false)
    expect(fit.details.weights_gb).toBeGreaterThan(0)
    expect(fit.details.activation_overhead_gb).toBeGreaterThan(0)
  })
})
