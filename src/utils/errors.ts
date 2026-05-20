/**
 * Human-friendly error messages for the most common failure modes.
 *
 * Goal: when something goes wrong, a user sees a one-line cause plus a
 * concrete next step. The raw SDK message is preserved as a "raw:" suffix
 * for debugging.
 */

export interface HumanizedError {
  /** One-line summary suitable as a CLI error line. */
  summary: string
  /** A "Try: <command>" hint when applicable. */
  hint?: string
  /** Original message for debug logs / --debug output. */
  raw: string
}

/** Minimal model context for the error humanizer — kept structural to avoid
 * coupling to ModelConfig's narrow `provider` union. */
export interface ErrorContext {
  base_url?: string
  provider?: string
  model?: string
  timeout_ms?: number
}

/**
 * Convert a raw provider error + model context into a humanized error.
 *
 * Detects: connection refused (Ollama / MLX / LM Studio), 401/403,
 * model-not-found, timeouts, missing base_url. Falls back to the raw
 * message when no pattern matches.
 */
export function humanizeProviderError(err: unknown, config?: ErrorContext): HumanizedError {
  const raw = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()
  const baseURL = config?.base_url ?? ''
  const provider = inferProvider(config, baseURL)

  // 1. Connection refused — local server not running
  if (lower.includes('econnrefused') || lower.includes('connection refused') || lower.includes('fetch failed')) {
    if (baseURL.includes('11434') || provider === 'ollama') {
      return {
        summary: `Can't reach Ollama at ${baseURL || 'localhost:11434'}.`,
        hint: 'Try: `ollama serve` (or `brew services start ollama` on macOS).',
        raw,
      }
    }
    if (baseURL.includes(':8080') || provider === 'mlx') {
      return {
        summary: `Can't reach MLX server at ${baseURL || 'localhost:8080'}.`,
        hint: 'Try: `mlx_lm.server --port 8080 --model <your-model>`.',
        raw,
      }
    }
    if (baseURL.includes('1234') || provider === 'lmstudio') {
      return {
        summary: `Can't reach LM Studio at ${baseURL || 'localhost:1234'}.`,
        hint: 'Open LM Studio → Local Server tab → start the server.',
        raw,
      }
    }
    return {
      summary: `Can't reach ${provider || 'model endpoint'} at ${baseURL || '(no base_url)'}.`,
      hint: 'Check that the server is running and the base_url in verdict.yaml is correct.',
      raw,
    }
  }

  // 2. Auth failures
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    const envHint = providerKeyEnv(provider)
    return {
      summary: `API key rejected${provider ? ` for ${provider}` : ''}.`,
      hint: envHint
        ? `Check that ${envHint} is set in your shell or .env.`
        : 'Check that the api_key in verdict.yaml is set (or its referenced env var).',
      raw,
    }
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return {
      summary: `Access forbidden${provider ? ` for ${provider}` : ''} — key may lack permission for this model.`,
      hint: 'Verify your account has access to this model on the provider dashboard.',
      raw,
    }
  }

  // 3. Model not found
  if (
    /not\s+found/.test(lower) ||
    lower.includes('does not exist') ||
    lower.includes('not_found_error') ||
    lower.includes('404')
  ) {
    const model = config?.model
    if (provider === 'ollama' && model) {
      return {
        summary: `Model "${model}" not installed on Ollama.`,
        hint: `Try: \`ollama pull ${model}\`.`,
        raw,
      }
    }
    return {
      summary: `Model "${model ?? '(unknown)'}" not found on ${provider || 'the endpoint'}.`,
      hint: 'Run `verdict models discover` to list available models, or check the model id spelling.',
      raw,
    }
  }

  // 4. Timeouts
  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('aborterror')) {
    const ms = config?.timeout_ms
    return {
      summary: `Request timed out${ms ? ` after ${(ms / 1000).toFixed(0)}s` : ''}.`,
      hint: 'Try: increase `timeout_ms` in verdict.yaml, or pick a smaller / faster model.',
      raw,
    }
  }

  // 5. Missing base_url
  if (lower.includes('no base_url') || lower.includes('missing base_url')) {
    return {
      summary: 'Model has no base_url.',
      hint: 'Set base_url in verdict.yaml, or use a provider shortcut (e.g. `provider: ollama`).',
      raw,
    }
  }

  // 6. Rate limiting
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      summary: 'Rate limited by provider.',
      hint: 'Try: reduce parallel_requests in verdict.yaml, or wait a minute and retry.',
      raw,
    }
  }

  // Fallback: return raw, no hint
  return { summary: raw, raw }
}

/**
 * Format a humanized error for printing. Returns a multi-line string with
 * the summary, hint (if any), and the raw line for debug.
 */
export function formatHumanError(err: HumanizedError, opts: { debug?: boolean } = {}): string {
  const lines: string[] = [err.summary]
  if (err.hint) lines.push(err.hint)
  if (opts.debug && err.raw !== err.summary) lines.push(`raw: ${err.raw}`)
  return lines.join('\n')
}

function inferProvider(config?: ErrorContext, baseURL = ''): string | undefined {
  if (config?.provider) return config.provider
  if (baseURL.includes('11434')) return 'ollama'
  if (baseURL.includes(':8080')) return 'mlx'
  if (baseURL.includes('1234')) return 'lmstudio'
  if (baseURL.includes('openrouter')) return 'openrouter'
  if (baseURL.includes('openai.com')) return 'openai'
  if (baseURL.includes('anthropic')) return 'anthropic'
  if (baseURL.includes('groq')) return 'groq'
  return undefined
}

function providerKeyEnv(provider?: string): string | undefined {
  switch (provider) {
    case 'openai': return 'OPENAI_API_KEY'
    case 'openrouter': return 'OPENROUTER_API_KEY'
    case 'anthropic': return 'ANTHROPIC_API_KEY'
    case 'groq': return 'GROQ_API_KEY'
    case 'mistral': return 'MISTRAL_API_KEY'
    default: return undefined
  }
}
