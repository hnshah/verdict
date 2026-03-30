/**
 * Universal OpenAI-compatible provider.
 *
 * Works with any endpoint that speaks POST /v1/chat/completions:
 * Ollama, MLX (mlx_lm.server), LM Studio, OpenRouter, Groq,
 * OpenAI, Anthropic (via proxy), and more.
 */

import OpenAI from 'openai'
import fs from 'fs'
import type { ModelConfig, ModelResponse, ToolDef } from '../types/index.js'
import { callOpenClaw, type OpenClawConfig } from './openclaw.js'
import { log as vlog } from '../utils/logger.js'

const clientCache = new Map<string, OpenAI>()

function getOrCreateClient(baseUrl: string, apiKey: string, timeout?: number): OpenAI {
  const key = baseUrl + ':::' + apiKey
  if (!clientCache.has(key)) {
    clientCache.set(key, new OpenAI({
      baseURL: baseUrl,
      apiKey,
      timeout,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/hnshah/verdict',
        'X-Title': 'verdict',
      },
    }))
  }
  return clientCache.get(key)!
}

export function clearClientCache(): void {
  clientCache.clear()
}

function loadImageAsBase64(imagePath: string): string | null {
  try {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // URL images are handled synchronously via fetch in the caller
      return null
    }
    const data = fs.readFileSync(imagePath)
    const ext = imagePath.split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : 'image/png'
    return `data:${mime};base64,${data.toString('base64')}`
  } catch {
    return null
  }
}

async function loadImageAsBase64Async(imagePath: string): Promise<string | null> {
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    try {
      const response = await fetch(imagePath)
      const buffer = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get('content-type') ?? 'image/png'
      return `data:${contentType};base64,${buffer.toString('base64')}`
    } catch {
      return null
    }
  }
  return loadImageAsBase64(imagePath)
}

export async function callModel(
  config: ModelConfig,
  prompt: string,
  attempt = 0,
  imagePath?: string,
  systemPrompt?: string
): Promise<ModelResponse> {
  // Route to OpenClaw provider if specified
  if (config.provider === 'openclaw') {
    return callOpenClaw(prompt, config as OpenClawConfig)
  }
  
  const baseURL = config.base_url
  if (!baseURL) throw new Error(`Model '${config.id}' has no base_url`)

  const apiKey = config.api_key === 'none' ? 'no-key-required' : (config.api_key ?? 'ollama')
  const client = getOrCreateClient(baseURL, apiKey, config.timeout_ms)

  const start = Date.now()

  // Build message content — with or without vision
  let messageContent: string | OpenAI.ChatCompletionContentPart[] = prompt
  if (imagePath) {
    const dataUrl = await loadImageAsBase64Async(imagePath)
    if (dataUrl) {
      messageContent = [
        { type: 'text' as const, text: prompt },
        { type: 'image_url' as const, image_url: { url: dataUrl } },
      ]
    }
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: messageContent })

  try {
    const requestBody = {
      model: config.model,
      messages: [{ role: 'user', content: typeof messageContent === 'string' ? messageContent : '[multipart content]' }],
      max_tokens: config.max_tokens,
      temperature: 0.0,
    }
    vlog('debug', `callModel ${config.id}: request`, JSON.stringify(requestBody))

    const response = await client.chat.completions.create({
      model: config.model,
      messages,
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

    vlog('debug', `callModel ${config.id}: response`, text)

    return { model_id: config.id, text, input_tokens, output_tokens, latency_ms, cost_usd }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // If vision content failed, retry without image
    if (imagePath && attempt === 0) {
      console.warn(`[verdict] Vision not supported by ${config.model}, retrying text-only`)
      return callModel(config, prompt, attempt + 1, undefined, systemPrompt)
    }
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      return callModel(config, prompt, attempt + 1, imagePath, systemPrompt)
    }
    return {
      model_id: config.id, text: '', input_tokens: 0,
      output_tokens: 0, latency_ms: Date.now() - start, error: msg
    }
  }
}

export async function callModelMultiTurn(
  config: ModelConfig,
  messages: Array<{ role: string; content: string }>,
  attempt = 0,
  systemPrompt?: string
): Promise<ModelResponse> {
  // Route to OpenClaw provider if specified
  if (config.provider === 'openclaw') {
    // Convert messages to single prompt (OpenClaw doesn't support multi-turn yet)
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
    return callOpenClaw(prompt, config as OpenClawConfig)
  }
  
  const baseURL = config.base_url
  if (!baseURL) throw new Error(`Model '${config.id}' has no base_url`)

  const apiKey = config.api_key === 'none' ? 'no-key-required' : (config.api_key ?? 'ollama')
  const client = getOrCreateClient(baseURL, apiKey, config.timeout_ms)

  const start = Date.now()

  const allMessages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt })
  }
  allMessages.push(...messages)

  try {
    vlog('debug', `callModelMultiTurn ${config.id}: ${messages.length} messages`, JSON.stringify(messages))

    const response = await client.chat.completions.create({
      model: config.model,
      messages: allMessages as OpenAI.ChatCompletionMessageParam[],
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

    vlog('debug', `callModelMultiTurn ${config.id}: response`, text)

    return { model_id: config.id, text, input_tokens, output_tokens, latency_ms, cost_usd }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      return callModelMultiTurn(config, messages, attempt + 1, systemPrompt)
    }
    return {
      model_id: config.id, text: '', input_tokens: 0,
      output_tokens: 0, latency_ms: Date.now() - start, error: msg
    }
  }
}

export async function callModelWithTools(
  config: ModelConfig,
  prompt: string,
  tools: ToolDef[],
  attempt = 0,
  systemPrompt?: string
): Promise<ModelResponse> {
  // Route to OpenClaw provider if specified
  if (config.provider === 'openclaw') {
    // OpenClaw doesn't support tools in this simple provider yet
    return callOpenClaw(prompt, config as OpenClawConfig)
  }
  
  const baseURL = config.base_url
  if (!baseURL) throw new Error(`Model '${config.id}' has no base_url`)

  const apiKey = config.api_key === 'none' ? 'no-key-required' : (config.api_key ?? 'ollama')
  const client = getOrCreateClient(baseURL, apiKey, config.timeout_ms)

  const start = Date.now()

  const openaiTools: OpenAI.ChatCompletionTool[] = tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    },
  }))

  const messages: OpenAI.ChatCompletionMessageParam[] = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  try {
    vlog('debug', `callModelWithTools ${config.id}: prompt + ${tools.length} tool(s)`, JSON.stringify({ prompt, tools: tools.map(t => t.name) }))

    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      tools: openaiTools,
      tool_choice: 'auto',
      max_tokens: config.max_tokens,
      temperature: 0.0,
    })

    const latency_ms = Date.now() - start
    const message = response.choices[0]?.message
    const text = message?.content ?? ''
    const input_tokens = response.usage?.prompt_tokens ?? 0
    const output_tokens = response.usage?.completion_tokens ?? 0
    const cost_usd = config.cost_per_1m_input && config.cost_per_1m_output
      ? (input_tokens / 1_000_000) * config.cost_per_1m_input
        + (output_tokens / 1_000_000) * config.cost_per_1m_output
      : 0

    const tool_calls = message?.tool_calls?.map(tc => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }))

    vlog('debug', `callModelWithTools ${config.id}: response`, JSON.stringify({ text, tool_calls }))

    return { model_id: config.id, text, input_tokens, output_tokens, latency_ms, cost_usd, tool_calls }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      return callModelWithTools(config, prompt, tools, attempt + 1, systemPrompt)
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
