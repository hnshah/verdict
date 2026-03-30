/**
 * OpenClaw provider for Verdict
 * 
 * Enables Verdict to test any model accessible via OpenClaw Gateway,
 * including Anthropic, xAI, OpenRouter, and 100+ models.
 */

import type { ModelConfig, ModelResponse } from '../types/index.js'

export interface OpenClawConfig extends ModelConfig {
  provider: 'openclaw'
  gateway_url?: string    // Default: http://127.0.0.1:18789
  gateway_token?: string  // Read from env or config
  agent_id?: string       // Which OpenClaw agent to use (default: 'main')
  stream?: boolean        // Stream responses (future)
}

/**
 * Call OpenClaw Gateway's OpenAI-compatible endpoint
 */
export async function callOpenClaw(
  prompt: string,
  config: OpenClawConfig
): Promise<ModelResponse> {
  const gatewayUrl = config.gateway_url || process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789'
  const token = config.gateway_token || process.env.OPENCLAW_GATEWAY_TOKEN
  const agentId = config.agent_id || 'main'
  
  if (!token) {
    throw new Error('OpenClaw gateway token required (set OPENCLAW_GATEWAY_TOKEN or config.gateway_token)')
  }
  
  const startTime = Date.now()
  
  try {
    const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-openclaw-agent-id': agentId
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: config.max_tokens || 2048,
        temperature: config.temperature ?? 0.7,
        stream: false  // Start with non-streaming
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenClaw API error (${response.status}): ${errorText}`)
    }
    
    const data = await response.json()
    const latency = Date.now() - startTime
    
    // Extract response text
    const text = data.choices?.[0]?.message?.content || ''
    
    if (!text) {
      throw new Error('Empty response from OpenClaw')
    }
    
    return {
      text,
      latency_ms: latency,
      model: config.model,
      cost_usd: calculateCost(data.usage, config.model),
      metadata: {
        provider: 'openclaw',
        gateway_url: gatewayUrl,
        agent_id: agentId,
        usage: data.usage,
        finish_reason: data.choices?.[0]?.finish_reason
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OpenClaw request failed: ${error.message}`)
    }
    throw error
  }
}

/**
 * Calculate cost for OpenClaw models
 * 
 * Note: OpenClaw routes to multiple providers, each with different pricing.
 * This is a best-effort estimate based on the model string.
 */
function calculateCost(
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
  modelId: string
): number | undefined {
  if (!usage?.prompt_tokens || !usage?.completion_tokens) {
    return undefined
  }
  
  const promptTokens = usage.prompt_tokens
  const completionTokens = usage.completion_tokens
  
  // Anthropic Claude pricing (as of 2026-03)
  if (modelId.includes('claude-sonnet-4')) {
    return (promptTokens * 0.003 + completionTokens * 0.015) / 1000
  }
  if (modelId.includes('claude-haiku-4')) {
    return (promptTokens * 0.00025 + completionTokens * 0.00125) / 1000
  }
  if (modelId.includes('claude-opus-4')) {
    return (promptTokens * 0.015 + completionTokens * 0.075) / 1000
  }
  
  // xAI Grok pricing
  if (modelId.includes('grok')) {
    return (promptTokens * 0.005 + completionTokens * 0.015) / 1000
  }
  
  // DeepSeek pricing
  if (modelId.includes('deepseek')) {
    return (promptTokens * 0.0001 + completionTokens * 0.0002) / 1000
  }
  
  // OpenAI GPT-4 pricing
  if (modelId.includes('gpt-4')) {
    return (promptTokens * 0.01 + completionTokens * 0.03) / 1000
  }
  
  // Unknown model - return undefined
  return undefined
}
