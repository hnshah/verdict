import os from 'os'
import { execSync } from 'child_process'

export interface HardwareInfo {
  cpu: string
  cpuCores: number
  cpuArch: string
  ram: string
  ramGB: number
  freeDiskGB?: number
  os: string
  osVersion: string
  gpu?: string
}

function quantBytesPerParam(quant: string): number {
  const normalized = quant.toLowerCase()
  if (normalized.includes('fp16') || normalized === 'f16' || normalized.includes('f16')) return 2
  if (normalized.includes('q8') || normalized.includes('8bit')) return 1
  if (normalized.includes('q5') || normalized.includes('5bit')) return 0.625
  if (normalized.includes('q4') || normalized.includes('4bit')) return 0.5
  return 0.5
}

/**
 * Estimate RAM needed to run a quantized model, including KV cache and runtime overhead.
 */
export function estimateRamGB(params_b: number, quant: string): number {
  return +(params_b * quantBytesPerParam(quant) * 1.2).toFixed(1)
}

function estimateDiskGB(params_b: number, quant: string): number {
  return +(params_b * quantBytesPerParam(quant) * 1.05).toFixed(1)
}

function detectFreeDiskGB(): number | undefined {
  try {
    const output = execSync('df -k /', { encoding: 'utf-8' }).trim()
    const line = output.split('\n')[1]
    if (!line) return undefined
    const parts = line.trim().split(/\s+/)
    const availableKb = Number(parts[3])
    if (!Number.isFinite(availableKb)) return undefined
    return +(availableKb / (1024 ** 2)).toFixed(1)
  } catch {
    return undefined
  }
}

/**
 * Check whether the current machine has enough RAM and disk for a model.
 */
export function checkFit(
  model: { name: string; params_b: number; quant: string },
  hw: HardwareInfo,
  opts?: { headroom_gb?: number }
): { fits: boolean; needs_gb: number; available_gb: number; reason?: string } {
  const headroomGB = opts?.headroom_gb ?? 4
  const needsGB = estimateRamGB(model.params_b, model.quant)
  const availableGB = Math.max(0, +(hw.ramGB - headroomGB).toFixed(1))

  if (needsGB > availableGB) {
    return {
      fits: false,
      needs_gb: needsGB,
      available_gb: availableGB,
      reason: `${model.name} needs ${needsGB} GB RAM at ${model.quant}; ${availableGB} GB available after ${headroomGB} GB headroom`,
    }
  }

  const diskGB = estimateDiskGB(model.params_b, model.quant)
  if (hw.freeDiskGB !== undefined && diskGB > hw.freeDiskGB) {
    return {
      fits: false,
      needs_gb: needsGB,
      available_gb: availableGB,
      reason: `${model.name} needs about ${diskGB} GB free disk to download; ${hw.freeDiskGB} GB available`,
    }
  }

  return {
    fits: true,
    needs_gb: needsGB,
    available_gb: availableGB,
  }
}

/**
 * Detect system hardware information
 */
export function detectHardware(): HardwareInfo {
  const platform = os.platform()
  const arch = os.arch()
  const cpuCores = os.cpus().length
  const totalMem = os.totalmem()
  const ramGB = Math.round(totalMem / (1024 ** 3))
  const freeDiskGB = detectFreeDiskGB()

  let cpu = os.cpus()[0]?.model || 'Unknown CPU'
  let osVersion = os.release()
  let gpu: string | undefined

  // macOS-specific detection
  if (platform === 'darwin') {
    try {
      // Get CPU model (e.g., "Apple M3 Ultra")
      const sysctl = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf-8' }).trim()
      if (sysctl) cpu = sysctl

      // Get macOS version (e.g., "14.2.1")
      const swVers = execSync('sw_vers -productVersion', { encoding: 'utf-8' }).trim()
      if (swVers) osVersion = swVers

      // Get GPU info
      try {
        const gpuInfo = execSync('system_profiler SPDisplaysDataType | grep "Chipset Model"', { encoding: 'utf-8' }).trim()
        const match = gpuInfo.match(/Chipset Model: (.+)/)
        if (match) gpu = match[1]
      } catch {
        // GPU detection failed, skip
      }
    } catch (err) {
      // Fallback to os.cpus() data
    }
  }

  // Format RAM (e.g., "256 GB")
  const ramFormatted = ramGB >= 1024 
    ? `${(ramGB / 1024).toFixed(1)} TB`
    : `${ramGB} GB`

  return {
    cpu,
    cpuCores,
    cpuArch: arch,
    ram: ramFormatted,
    ramGB,
    freeDiskGB,
    os: platform === 'darwin' ? 'macOS' : platform === 'linux' ? 'Linux' : platform === 'win32' ? 'Windows' : platform,
    osVersion,
    gpu
  }
}

/**
 * Get a human-readable hardware summary
 */
export function getHardwareSummary(hw: HardwareInfo): string {
  const parts = [
    hw.cpu,
    `${hw.cpuCores} cores`,
    hw.ram,
    `${hw.os} ${hw.osVersion}`
  ]
  
  if (hw.gpu) {
    parts.splice(2, 0, hw.gpu)
  }

  return parts.join(' • ')
}

/**
 * Convert to RunResult format (normalized)
 */
export function toRunResultFormat(hw: HardwareInfo): {
  cpu: string
  cpu_cores: number
  cpu_arch: string
  ram_gb: number
  free_disk_gb?: number
  gpu?: string
  os: string
  os_version: string
} {
  return {
    cpu: hw.cpu,
    cpu_cores: hw.cpuCores,
    cpu_arch: hw.cpuArch,
    ram_gb: hw.ramGB,
    free_disk_gb: hw.freeDiskGB,
    gpu: hw.gpu,
    os: hw.os,
    os_version: hw.osVersion
  }
}
