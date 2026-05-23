import type { ModelConfig } from '../types/index.js'

export interface OllamaChatMessage {
  role: string
  content: string
}

export interface OllamaChatResult {
  text: string
  input_tokens: number
  output_tokens: number
}

function ollamaApiBase(config: ModelConfig): string | null {
  if (config.provider !== 'ollama' && !config.base_url?.includes('11434')) return null

  if (config.host) return `http://${config.host}`
  if (config.base_url) return config.base_url.replace(/\/v1\/?$/, '')

  const host = process.env['OLLAMA_HOST'] ?? 'localhost:11434'
  return host.startsWith('http://') || host.startsWith('https://') ? host : `http://${host}`
}

export async function callOllamaChatNative(
  config: ModelConfig,
  messages: OllamaChatMessage[],
  opts: { max_tokens?: number; temperature?: number } = {},
): Promise<OllamaChatResult | null> {
  const base = ollamaApiBase(config)
  if (!base) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeout_ms)

  try {
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        think: false,
        options: {
          temperature: opts.temperature ?? 0,
          num_predict: opts.max_tokens ?? config.max_tokens,
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Ollama native chat failed (${response.status}): ${text}`)
    }

    const data = await response.json() as {
      message?: { content?: string }
      prompt_eval_count?: number
      eval_count?: number
    }

    return {
      text: data.message?.content ?? '',
      input_tokens: data.prompt_eval_count ?? 0,
      output_tokens: data.eval_count ?? 0,
    }
  } finally {
    clearTimeout(timeout)
  }
}
