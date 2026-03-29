import os from 'os'
import { execSync } from 'child_process'

export interface HardwareInfo {
  cpu: string
  cpuCores: number
  cpuArch: string
  ram: string
  ramGB: number
  os: string
  osVersion: string
  gpu?: string
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
  gpu?: string
  os: string
  os_version: string
} {
  return {
    cpu: hw.cpu,
    cpu_cores: hw.cpuCores,
    cpu_arch: hw.cpuArch,
    ram_gb: hw.ramGB,
    gpu: hw.gpu,
    os: hw.os,
    os_version: hw.osVersion
  }
}
