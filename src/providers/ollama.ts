/**
 * Deep Ollama integration.
 *
 * Beyond inference (which goes through compat.ts), this module handles:
 * - Auto-discovering running Ollama instances
 * - Listing locally available models
 * - Detecting MoE models by name pattern
 * - Checking if a model needs to be pulled
 */

import http from 'http'
import type { DiscoveredModel } from '../types/index.js'

const DEFAULT_HOSTS = [
  'localhost:11434',
  '127.0.0.1:11434',
]

// Known MoE model name patterns
const MOE_PATTERNS = [
  /deepseek-r1/i,
  /deepseek-v[23]/i,
  /mixtral/i,
  /qwen.*moe/i,
  /phi.*moe/i,
  /llama.*moe/i,
  /8x/i,          // "8x7b", "8x22b" naming convention
  /moe/i,
]

function isMoE(modelName: string): boolean {
  return MOE_PATTERNS.some(p => p.test(modelName))
}

interface OllamaTagsResponse {
  models: Array<{
    name: string
    size: number
    details?: { family?: string; parameter_size?: string }
  }>
}

function httpGet(host: string, path: string, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const [hostname, portStr] = host.split(':')
    const req = http.request({
      hostname, port: parseInt(portStr ?? '11434'), path, method: 'GET',
      timeout: timeoutMs,
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

export async function discoverOllama(
  hosts: string[] = DEFAULT_HOSTS
): Promise<DiscoveredModel[]> {
  const found: DiscoveredModel[] = []

  for (const host of hosts) {
    try {
      const body = await httpGet(host, '/api/tags')
      const data = JSON.parse(body) as OllamaTagsResponse
      const base_url = `http://${host}/v1`

      for (const model of data.models ?? []) {
        const name = model.name
        const size_gb = model.size ? +(model.size / 1e9).toFixed(1) : undefined
        const moe = isMoE(name)
        // Build a clean id from model name (strip tag, slugify)
        const id = name.replace(/:.*/, '').replace(/[^a-z0-9]/gi, '-').toLowerCase()
        const tags: string[] = ['local', 'free']
        if (moe) tags.push('moe')

        found.push({ provider: 'ollama', id, model: name, base_url, size_gb, is_moe: moe, tags })
      }
    } catch {
      // Host not running — skip silently
    }
  }

  return found
}

export async function isOllamaRunning(host = 'localhost:11434'): Promise<boolean> {
  try {
    await httpGet(host, '/api/tags', 2000)
    return true
  } catch {
    return false
  }
}

export async function listOllamaModels(host = 'localhost:11434'): Promise<string[]> {
  try {
    const body = await httpGet(host, '/api/tags')
    const data = JSON.parse(body) as OllamaTagsResponse
    return (data.models ?? []).map(m => m.name)
  } catch {
    return []
  }
}
