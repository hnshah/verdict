import { describe, it, expect } from 'vitest'
import { humanizeProviderError, formatHumanError } from '../errors.js'

describe('humanizeProviderError', () => {
  it('detects Ollama connection refused', () => {
    const e = humanizeProviderError(new Error('connect ECONNREFUSED 127.0.0.1:11434'), {
      base_url: 'http://localhost:11434/v1',
      provider: 'ollama',
    })
    expect(e.summary).toMatch(/Can't reach Ollama/)
    expect(e.hint).toMatch(/ollama serve/)
  })

  it('detects MLX connection refused', () => {
    const e = humanizeProviderError(new Error('fetch failed'), {
      base_url: 'http://localhost:8080/v1',
      provider: 'mlx',
    })
    expect(e.summary).toMatch(/MLX/)
    expect(e.hint).toMatch(/mlx_lm.server/)
  })

  it('detects LM Studio connection refused', () => {
    const e = humanizeProviderError(new Error('ECONNREFUSED'), {
      base_url: 'http://localhost:1234/v1',
    })
    expect(e.summary).toMatch(/LM Studio/)
    expect(e.hint).toMatch(/Local Server tab/)
  })

  it('detects 401 unauthorized with provider hint', () => {
    const e = humanizeProviderError(new Error('Request failed with status 401'), {
      provider: 'openrouter',
    })
    expect(e.summary).toMatch(/API key rejected/)
    expect(e.hint).toMatch(/OPENROUTER_API_KEY/)
  })

  it('detects 403 forbidden', () => {
    const e = humanizeProviderError(new Error('403 Forbidden'), { provider: 'openai' })
    expect(e.summary).toMatch(/forbidden/i)
  })

  it('detects Ollama model not found with pull suggestion', () => {
    const e = humanizeProviderError(new Error('model "qwen2.5:7b" not found'), {
      provider: 'ollama',
      model: 'qwen2.5:7b',
    })
    expect(e.summary).toMatch(/not installed on Ollama/)
    expect(e.hint).toMatch(/ollama pull qwen2\.5:7b/)
  })

  it('detects cloud model not found', () => {
    const e = humanizeProviderError(new Error('Not Found 404'), {
      provider: 'openrouter',
      model: 'foo/bar',
    })
    expect(e.summary).toMatch(/foo\/bar/)
    expect(e.hint).toMatch(/verdict models discover/)
  })

  it('detects timeout', () => {
    const e = humanizeProviderError(new Error('Request timeout'), {
      timeout_ms: 30000,
    })
    expect(e.summary).toMatch(/timed out after 30s/)
    expect(e.hint).toMatch(/timeout_ms/)
  })

  it('detects missing base_url', () => {
    const e = humanizeProviderError(new Error("Model 'foo' has no base_url"))
    expect(e.summary).toMatch(/no base_url/)
    expect(e.hint).toMatch(/provider shortcut/)
  })

  it('detects rate limit (429)', () => {
    const e = humanizeProviderError(new Error('429 Too Many Requests'), {})
    expect(e.summary).toMatch(/Rate limited/)
    expect(e.hint).toMatch(/parallel_requests/)
  })

  it('falls back to raw message when no pattern matches', () => {
    const e = humanizeProviderError(new Error('Some unknown failure'), {})
    expect(e.summary).toBe('Some unknown failure')
    expect(e.hint).toBeUndefined()
  })

  it('handles non-Error throws', () => {
    const e = humanizeProviderError('plain string', {})
    expect(e.summary).toBe('plain string')
  })

  it('format includes summary + hint by default', () => {
    const formatted = formatHumanError({
      summary: 'Cannot reach X',
      hint: 'Try Y',
      raw: 'ECONNREFUSED',
    })
    expect(formatted).toBe('Cannot reach X\nTry Y')
  })

  it('format includes raw under debug', () => {
    const formatted = formatHumanError({
      summary: 'Cannot reach X',
      hint: 'Try Y',
      raw: 'ECONNREFUSED',
    }, { debug: true })
    expect(formatted).toMatch(/raw: ECONNREFUSED/)
  })
})
