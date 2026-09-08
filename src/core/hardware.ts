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
 * Estimate RAM needed to run a quantized model, including a baseline KV cache
 * at the common 8K context. Keep this function stable — onboarding/planner
 * and the catalog UI use it for at-a-glance estimates.
 *
 * `checkFit` does its own decomposition (weights + overhead + KV) so it can
 * scale the KV cache by the actual context window the caller plans to use,
 * without changing this function's contract.
 */
export function estimateRamGB(params_b: number, quant: string): number {
  return +(params_b * quantBytesPerParam(quant) * 1.2).toFixed(1)
}

function estimateDiskGB(params_b: number, quant: string): number {
  return +(params_b * quantBytesPerParam(quant) * 1.05).toFixed(1)
}

/** Raw weights at the given quantization, no overhead, no KV cache. */
function estimateWeightsGB(params_b: number, quant: string): number {
  return +(params_b * quantBytesPerParam(quant)).toFixed(2)
}

/** Activations, kernels, framework overhead. Empirically ~15% of weights. */
function estimateActivationOverheadGB(weights_gb: number): number {
  return +(weights_gb * 0.15).toFixed(2)
}

/**
 * Estimate KV-cache footprint for a given context window. This is a *rough*
 * heuristic intended for headroom-gating, not exact memory accounting:
 *
 *  - The constant is calibrated for modern GQA architectures (Llama-3, Qwen2,
 *    Mistral). Non-GQA models (older Llama-1/2, some 3B research models) will
 *    use more cache than this estimate predicts; flag this in the fit reason
 *    rather than refusing the pull.
 *  - llama.cpp can quantize the cache (`-ctk q4_0`). We assume fp16 cache;
 *    callers using a quantized cache will be over-budgeted, which is the
 *    safer error direction.
 *
 * 7B at 8K ≈ 0.07 GB; 14B at 32K ≈ 0.6 GB; 70B at 128K ≈ 12 GB. Linear in both.
 */
export function estimateKvCacheGB(params_b: number, context_tokens: number): number {
  if (context_tokens <= 0 || params_b <= 0) return 0
  return +(params_b * context_tokens * 0.0000013).toFixed(2)
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

export interface CheckFitOpts {
  /** OS headroom (GB) reserved for the rest of the system. Default 4. */
  headroom_gb?: number
  /**
   * Minimum free disk we want to keep after the download. Default 25 GB
   * (matches the Phase-1 resource_guard default). The pull is rejected if
   * accepting it would push free disk below this threshold.
   */
  min_free_disk_gb?: number
  /**
   * Current memory pressure (from `verdict machine inspect`, or any caller).
   * Multiplies the *default* OS headroom — not a caller-supplied
   * `headroom_gb`, so callers can pin their own budget. critical = 3×, warn
   * = 1.5×, normal = 1×. Critical does NOT short-circuit-reject; small
   * models that fit even under tight headroom still pass.
   */
  memory_pressure?: 'normal' | 'warn' | 'critical'
  /**
   * Context window the model will be used at. Default 8192 — matches the
   * common case. Larger contexts pay for themselves in KV cache headroom.
   */
  context_tokens?: number
  /**
   * Apple Silicon shares RAM between CPU and GPU. When true (or
   * auto-detected from `hw.cpuArch === 'arm64' && hw.os === 'macOS'`), reserve
   * an extra 2 GB because Metal allocations and macOS UI all come out of the
   * same pool. Pass `false` to force-disable.
   */
  unified_memory?: boolean
}

export interface CheckFitResult {
  fits: boolean
  needs_gb: number
  available_gb: number
  reason?: string
  details: {
    weights_gb: number
    activation_overhead_gb: number
    kv_cache_gb: number
    headroom_gb: number
    unified_reserve_gb: number
    free_disk_after_pull_gb?: number
  }
}

/**
 * Check whether the current machine has enough RAM and disk for a model,
 * given current memory pressure, KV-cache requirements at the planned
 * context window, and the disk reserve we want to keep free.
 *
 * The budget is decomposed into weights + activations + KV cache so callers
 * can show users *why* a model is tight or rejected. The check is intended
 * to be called from runtime gating code (e.g. `verdict run`) as well as the
 * onboarding planner.
 */
export function checkFit(
  model: { name: string; params_b: number; quant: string },
  hw: HardwareInfo,
  opts?: CheckFitOpts
): CheckFitResult {
  const callerHeadroom = opts?.headroom_gb
  const pressure = opts?.memory_pressure ?? 'normal'
  const contextTokens = opts?.context_tokens ?? 8192
  const minFreeDisk = opts?.min_free_disk_gb ?? 25

  // Pressure multiplier applies only to the *default* OS headroom, not to a
  // caller-supplied value. A pro user who deliberately set headroom_gb: 8
  // shouldn't have it secretly bumped to 12 when pressure spikes.
  const pressureMultiplier = pressure === 'critical' ? 3 : pressure === 'warn' ? 1.5 : 1
  const headroomGB = callerHeadroom !== undefined
    ? callerHeadroom
    : +(4 * pressureMultiplier).toFixed(1)

  // Auto-detect Apple Silicon when caller didn't specify. Unified-memory
  // machines pay an extra reserve for Metal + OS UI.
  const isAppleSilicon = hw.cpuArch === 'arm64' && hw.os === 'macOS'
  const unifiedMemory = opts?.unified_memory ?? isAppleSilicon
  const unifiedReserveGB = unifiedMemory ? 2 : 0

  // Decompose the RAM budget so we don't double-count KV (the legacy
  // `estimateRamGB` already had an implicit KV allowance baked into its 1.2×
  // overhead — checkFit avoids that by going to first principles).
  const weightsGB = estimateWeightsGB(model.params_b, model.quant)
  const activationGB = estimateActivationOverheadGB(weightsGB)
  const kvCacheGB = estimateKvCacheGB(model.params_b, contextTokens)
  const needsGBraw = weightsGB + activationGB + kvCacheGB
  const needsGB = +needsGBraw.toFixed(1)
  const availableGBraw = Math.max(0, hw.ramGB - headroomGB - unifiedReserveGB)
  const availableGB = +availableGBraw.toFixed(1)

  const details: CheckFitResult['details'] = {
    weights_gb: weightsGB,
    activation_overhead_gb: activationGB,
    kv_cache_gb: kvCacheGB,
    headroom_gb: headroomGB,
    unified_reserve_gb: unifiedReserveGB,
  }

  if (needsGBraw > availableGBraw) {
    const pressureNote = pressure !== 'normal' ? ` (pressure ${pressure} → ${pressureMultiplier}× default headroom)` : ''
    return {
      fits: false,
      needs_gb: needsGB,
      available_gb: availableGB,
      reason: `${model.name} needs ${needsGB} GB (weights ${weightsGB} + activations ${activationGB} + kv ${kvCacheGB} at ${contextTokens} ctx) at ${model.quant}; ${availableGB} GB available after ${headroomGB} GB OS headroom${unifiedReserveGB ? ` + ${unifiedReserveGB} GB unified-memory reserve` : ''}${pressureNote}`,
      details,
    }
  }

  const diskGB = estimateDiskGB(model.params_b, model.quant)
  if (hw.freeDiskGB !== undefined) {
    // Check oversize first (clearer error than "would leave -X GB").
    if (diskGB > hw.freeDiskGB) {
      return {
        fits: false,
        needs_gb: needsGB,
        available_gb: availableGB,
        reason: `${model.name} needs about ${diskGB} GB free disk to download; ${hw.freeDiskGB} GB available`,
        details: { ...details, free_disk_after_pull_gb: +(hw.freeDiskGB - diskGB).toFixed(1) },
      }
    }
    const freeAfterPullRaw = hw.freeDiskGB - diskGB
    const freeAfterPull = +freeAfterPullRaw.toFixed(1)
    // Use the *unrounded* comparison so 24.95 isn't presented as "25 GB free, OK".
    if (freeAfterPullRaw < minFreeDisk) {
      return {
        fits: false,
        needs_gb: needsGB,
        available_gb: availableGB,
        reason: `${model.name} would leave ${freeAfterPull} GB free after pull; reserve is ${minFreeDisk} GB`,
        details: { ...details, free_disk_after_pull_gb: freeAfterPull },
      }
    }
    return {
      fits: true,
      needs_gb: needsGB,
      available_gb: availableGB,
      details: { ...details, free_disk_after_pull_gb: freeAfterPull },
    }
  }

  return {
    fits: true,
    needs_gb: needsGB,
    available_gb: availableGB,
    details,
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
