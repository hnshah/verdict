/**
 * Sub-agent provider for Verdict
 * 
 * Enables Verdict to evaluate sub-agents as models.
 * Spawns sub-agents via sessions_spawn and waits for completion.
 */

import type { ModelConfig, ModelResponse } from '../types/index.js'

export interface SubAgentConfig extends ModelConfig {
  provider: 'subagent'
  runtime?: 'subagent' | 'acp'    // Default: subagent
  mode?: 'run' | 'session'        // Default: run
  agent_id?: string               // Which agent config to use
  timeout_seconds?: number        // Spawn timeout
}

/**
 * Call a sub-agent to generate a response
 * 
 * This spawns a sub-agent, waits for completion, and returns the response.
 * Useful for comparing sub-agent performance vs direct API calls.
 */
export async function callSubAgent(
  prompt: string,
  config: SubAgentConfig
): Promise<ModelResponse> {
  const startTime = Date.now()
  
  try {
    // Spawn sub-agent
    const spawnResult = await spawnSubAgent({
      task: prompt,
      runtime: config.runtime || 'subagent',
      mode: config.mode || 'run',
      model: config.model,
      agentId: config.agent_id,
      runTimeoutSeconds: config.timeout_seconds || 300
    })
    
    if (spawnResult.status !== 'accepted') {
      throw new Error(`Sub-agent spawn failed: ${spawnResult.status}`)
    }
    
    // Wait for completion (push-based)
    const result = await waitForSubAgentCompletion(
      spawnResult.childSessionKey,
      config.timeout_seconds || 300
    )
    
    const latency = Date.now() - startTime
    
    return {
      text: result.message,
      latency_ms: latency,
      model: config.model,
      metadata: {
        provider: 'subagent',
        session_key: spawnResult.childSessionKey,
        run_id: spawnResult.runId,
        runtime: config.runtime || 'subagent',
        mode: config.mode || 'run'
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Sub-agent request failed: ${error.message}`)
    }
    throw error
  }
}

/**
 * Spawn a sub-agent
 * 
 * Note: This is a placeholder - in production this would call sessions_spawn
 * For now, returns a mock result to enable type checking
 */
async function spawnSubAgent(params: {
  task: string
  runtime: string
  mode: string
  model: string
  agentId?: string
  runTimeoutSeconds: number
}): Promise<{
  status: string
  childSessionKey: string
  runId: string
}> {
  // TODO: Implement actual sessions_spawn call
  // For now, throw error to indicate it needs integration
  throw new Error('Sub-agent spawning not yet implemented - needs sessions_spawn integration')
  
  // Future implementation:
  // return await sessions_spawn({
  //   task: params.task,
  //   runtime: params.runtime as 'subagent' | 'acp',
  //   mode: params.mode as 'run' | 'session',
  //   model: params.model,
  //   runTimeoutSeconds: params.runTimeoutSeconds
  // })
}

/**
 * Wait for sub-agent completion
 * 
 * Polls session history until completion or timeout.
 */
async function waitForSubAgentCompletion(
  sessionKey: string,
  timeoutSeconds: number
): Promise<{ message: string }> {
  const startTime = Date.now()
  const timeoutMs = timeoutSeconds * 1000
  
  while (Date.now() - startTime < timeoutMs) {
    // TODO: Implement actual session history polling
    // For now, throw error
    throw new Error('Sub-agent completion waiting not yet implemented - needs sessions_history')
    
    // Future implementation:
    // const history = await sessions_history({ sessionKey, limit: 1 })
    // if (history.messages.length > 0) {
    //   const lastMessage = history.messages[history.messages.length - 1]
    //   if (lastMessage.role === 'assistant') {
    //     return { message: extractTextFromMessage(lastMessage) }
    //   }
    // }
    // await sleep(1000) // Poll every second
  }
  
  throw new Error(`Sub-agent timeout after ${timeoutSeconds}s`)
}

/**
 * Extract text from message content
 */
function extractTextFromMessage(message: any): string {
  if (typeof message.content === 'string') {
    return message.content
  }
  
  if (Array.isArray(message.content)) {
    const textParts = message.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
    return textParts.join('\n')
  }
  
  return ''
}
