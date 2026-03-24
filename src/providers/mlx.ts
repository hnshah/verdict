/**
 * Deep MLX integration.
 *
 * MLX runs on Apple Silicon (M1/M2/M3/M4) via mlx-lm.
 * Start a server: mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit --port 8080
 * It exposes /v1/chat/completions (OpenAI-compatible).
 *
 * This module handles auto-detection of running MLX servers
 * and surfaces Apple Silicon-specific context.
 */

import http from 'http'
import type { DiscoveredModel } from '../types/index.js'

const DEFAULT_PORTS = [8080, 8081, 8082, 5000]

// MLX Community models often follow: mlx-community/<base-model>-<quant>bit
// MoE models in MLX
const MLX_MOE_PATTERNS = [/deepseek-r1/i, /deepseek-v[23]/i, /mixtral/i, /qwen.*moe/i, /moe/i]

function isMoE(model: string): boolean {
  return MLX_MOE_PATTERNS.some(p => p.test(model))
}

function httpGet(port: number, path: string, timeoutMs = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port, path, method: 'GET', timeout: timeoutMs,
    }, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => resolve(body))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

interface MLXModelsResponse {
  data?: Array<{ id: string }>
}

export async function discoverMLX(ports: number[] = DEFAULT_PORTS): Promise<DiscoveredModel[]> {
  const found: DiscoveredModel[] = []

  for (const port of ports) {
    try {
      const body = await httpGet(port, '/v1/models')
      const data = JSON.parse(body) as MLXModelsResponse
      const base_url = `http://localhost:${port}/v1`

      for (const m of data.data ?? []) {
        const model = m.id
        const id = model.split('/').pop()?.replace(/[^a-z0-9]/gi, '-').toLowerCase() ?? `mlx-${port}`
        const moe = isMoE(model)
        const tags: string[] = ['local', 'free', 'mlx', 'apple-silicon']
        if (moe) tags.push('moe')
        found.push({ provider: 'mlx', id, model, base_url, is_moe: moe, tags })
      }
    } catch {
      // Port not active
    }
  }

  return found
}

export async function isMLXRunning(port = 8080): Promise<boolean> {
  try {
    await httpGet(port, '/v1/models')
    return true
  } catch {
    return false
  }
}

export function mlxStartCommand(model: string, port = 8080): string {
  return `mlx_lm.server --model ${model} --port ${port}`
}
