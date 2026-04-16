/**
 * Deep LM Studio integration.
 *
 * LM Studio runs GGUF models locally with an OpenAI-compatible API server.
 * Start the server: lms daemon up && lms server start --port 1234
 * Or via desktop app with JIT enabled.
 *
 * This module handles auto-detection of running LM Studio instances
 * and surfaces model metadata (size, quantization, context length).
 */

import http from 'http'
import type { DiscoveredModel } from '../types/index.js'

const DEFAULT_PORT = 1234
const DEFAULT_HOST = 'localhost'

interface LMStudioModelsResponse {
  data?: Array<{
    id: string
    object?: string
  }>
  models?: Array<{
    key: string
    display_name?: string
    quantization?: { name?: string; bits_per_weight?: number }
    size_bytes?: number
    max_context_length?: number
  }>
}

function httpGet(host: string, port: number, path: string, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host, port, path, method: 'GET', timeout: timeoutMs,
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

function estimateSizeGb(sizeBytes?: number): number | undefined {
  if (!sizeBytes) return undefined
  return +(sizeBytes / 1e9).toFixed(1)
}

export async function discoverLMStudio(host = DEFAULT_HOST, port = DEFAULT_PORT): Promise<DiscoveredModel[]> {
  const found: DiscoveredModel[] = []
  const base_url = `http://${host}:${port}/v1`

  try {
    const body = await httpGet(host, port, '/v1/models')
    const data = JSON.parse(body) as LMStudioModelsResponse

    // LM Studio API: { data: [{ id }] } or { models: [{ key, ... }] }
    const models = data.data ?? data.models ?? []

    for (const m of models) {
      // Two possible shapes
      const modelId = (m as { id?: string }).id ?? (m as { key?: string }).key
      if (!modelId) continue

      // Skip embedding models
      if (modelId.includes('embedding') || modelId.includes('embed')) continue

      const displayName = (m as { display_name?: string }).display_name ?? modelId
      const quantization = (m as { quantization?: { name?: string; bits_per_weight?: number } }).quantization
      const sizeBytes = (m as { size_bytes?: number }).size_bytes
      const maxContext = (m as { max_context_length?: number }).max_context_length

      const id = modelId.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      const size_gb = estimateSizeGb(sizeBytes)
      const tags = ['local', 'free', 'gguf', 'lm-studio']
      if (quantization?.name) tags.push(`q${quantization.bits_per_weight ?? '?'}`)
      if (maxContext && maxContext >= 32000) tags.push('long-context')

      found.push({
        provider: 'lmstudio',
        id,
        model: modelId,
        display_name: displayName,
        base_url,
        size_gb,
        context_window: maxContext,
        tags,
      })
    }
  } catch {
    // LM Studio not running on this port
  }

  return found
}

export async function isLMStudioRunning(host = DEFAULT_HOST, port = DEFAULT_PORT): Promise<boolean> {
  try {
    await httpGet(host, port, '/v1/models')
    return true
  } catch {
    return false
  }
}

export function lmStudioStartCommand(): string {
  return 'lms daemon up && lms server start --port 1234'
}
