import type { ModelConfig } from '../types/index.js'

/** Build a minimal ModelConfig from a model ID and provider name. */
export function buildModelConfig(modelId: string, provider: string): ModelConfig {
  const config: ModelConfig = {
    id: modelId,
    model: modelId,
    api_key: 'none',
    tags: [],
    port: 8080,
    timeout_ms: 120_000,
    max_tokens: 4096,
  }

  switch (provider) {
    case 'ollama': {
      const host = process.env['OLLAMA_HOST'] ?? 'http://localhost:11434'
      config.base_url = host.endsWith('/v1') ? host : `${host}/v1`
      break
    }
    case 'mlx': {
      const port = process.env['MLX_PORT'] ?? '8080'
      config.base_url = `http://localhost:${port}/v1`
      break
    }
    case 'openrouter':
      config.base_url = 'https://openrouter.ai/api/v1'
      config.api_key = process.env['OPENROUTER_API_KEY'] ?? 'none'
      break
    case 'openai':
      config.base_url = 'https://api.openai.com/v1'
      config.api_key = process.env['OPENAI_API_KEY'] ?? 'none'
      break
    default: {
      const host = process.env['OLLAMA_HOST'] ?? 'http://localhost:11434'
      config.base_url = host.endsWith('/v1') ? host : `${host}/v1`
      break
    }
  }

  return config
}
