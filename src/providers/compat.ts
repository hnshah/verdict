/**
 * Universal OpenAI-compatible provider.
 *
 * Works with any endpoint that speaks POST /v1/chat/completions:
 * Ollama, MLX (mlx_lm.server), LM Studio, OpenRouter, Groq,
 * OpenAI, Anthropic (via proxy), and more.
 */

import OpenAI from 'openai'
import type { ModelConfig, ModelResponse } from '../types/index.js'

export async function callModel(
  config: ModelConfig,
  prompt: string,
  attempt = 0
): Promise<ModelResponse> {
  const baseURL = config.base_url
  if (!baseURL) throw new Error(`Model '${config.id}' has no base_url`)

  const client = new OpenAI({
    baseURL,
    apiKey: config.api_key === 'none' ? 'no-key-required' : config.api_key,
    timeout: config.timeout_ms,
    defaultHeaders: {
      // Required by some providers (OpenRouter, etc.)
      'HTTP-Referer': 'https://github.com/hnshah/verdict',
      'X-Title': 'verdict',
    },
  })

  const start = Date.now()

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: config.max_tokens,
      temperature: 0.0,
    })

    const latency_ms = Date.now() - start
    const text = response.choices[0]?.message?.content ?? ''
    const input_tokens = response.usage?.prompt_tokens ?? 0
    const output_tokens = response.usage?.completion_tokens ?? 0
    const cost_usd = config.cost_per_1m_input && config.cost_per_1m_output
      ? (input_tokens / 1_000_000) * config.cost_per_1m_input
        + (output_tokens / 1_000_000) * config.cost_per_1m_output
      : 0

    return { model_id: config.id, text, input_tokens, output_tokens, latency_ms, cost_usd }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      return callModel(config, prompt, attempt + 1)
    }
    return {
      model_id: config.id, text: '', input_tokens: 0,
      output_tokens: 0, latency_ms: Date.now() - start, error: msg
    }
  }
}

export async function pingModel(config: ModelConfig): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const result = await callModel({ ...config, max_tokens: 5, timeout_ms: 10_000 }, 'Reply with one word: pong')
  if (result.error) return { ok: false, latency_ms: result.latency_ms, error: result.error }
  if (!result.text) return { ok: false, latency_ms: result.latency_ms, error: 'empty response' }
  return { ok: true, latency_ms: result.latency_ms }
}
