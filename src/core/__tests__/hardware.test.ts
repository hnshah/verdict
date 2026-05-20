import { describe, expect, it } from 'vitest'
import { checkFit, estimateRamGB, type HardwareInfo } from '../hardware.js'

const baseHardware: HardwareInfo = {
  cpu: 'Test CPU',
  cpuCores: 8,
  cpuArch: 'arm64',
  ram: '32 GB',
  ramGB: 32,
  freeDiskGB: 100,
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

describe('checkFit', () => {
  it('allows a model that fits comfortably', () => {
    const fit = checkFit(
      { name: 'qwen2.5:7b', params_b: 7, quant: 'q4_K_M' },
      baseHardware
    )

    expect(fit.fits).toBe(true)
    expect(fit.needs_gb).toBe(4.2)
    expect(fit.available_gb).toBe(28)
  })

  it('rejects a model that exceeds available RAM', () => {
    const fit = checkFit(
      { name: 'llama3.1:70b', params_b: 70, quant: 'q4_K_M' },
      baseHardware
    )

    expect(fit.fits).toBe(false)
    expect(fit.reason).toContain('needs 42 GB RAM')
  })

  it('rejects a model when disk space is too low', () => {
    const fit = checkFit(
      { name: 'qwen2.5:7b', params_b: 7, quant: 'q4_K_M' },
      { ...baseHardware, freeDiskGB: 2 }
    )

    expect(fit.fits).toBe(false)
    expect(fit.reason).toContain('free disk')
  })
})
