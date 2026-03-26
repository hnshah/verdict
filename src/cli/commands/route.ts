/**
 * `verdict route` command — select and query the best model using eval history.
 */

import chalk from 'chalk'
import { getDb, initSchema } from '../../db/client.js'
import { selectModel } from '../../router/selector.js'
import { callModel } from '../../providers/compat.js'
import type { ModelConfig } from '../../types/index.js'

interface RouteCommandOpts {
  type?: string
  prefer?: string
  minScore?: string
  dryRun?: boolean
  model?: string
}

export async function routeCommand(prompt: string, opts: RouteCommandOpts): Promise<void> {
  let db
  try {
    db = getDb()
    initSchema(db)
  } catch (err) {
    console.error(chalk.red(`  Failed to open database: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  let selectedModelId: string
  let selectedProvider: string
  let selectedScore: number | null = null
  let reason: string

  if (opts.model) {
    // Force a specific model
    selectedModelId = opts.model
    selectedProvider = 'manual'
    reason = 'Manually specified'
  } else {
    // Use router to select best model
    const selected = selectModel(db, {
      taskType: opts.type,
      preferLocal: opts.prefer === 'local',
      minScore: opts.minScore ? parseFloat(opts.minScore) : undefined,
    })

    if (!selected) {
      console.error(chalk.red('  No model found matching criteria. Run `verdict run` first to build eval history.'))
      db.close()
      process.exit(1)
    }

    selectedModelId = selected.modelId
    selectedProvider = selected.provider
    selectedScore = selected.score
    reason = selected.reason
  }

  db.close()

  const scoreInfo = selectedScore !== null ? ` (${selectedScore.toFixed(1)}/10)` : ''
  console.log(chalk.cyan(`  → routing to ${selectedModelId}${scoreInfo}`))
  console.log(chalk.dim(`    ${reason}`))
  console.log()

  if (opts.dryRun) {
    console.log(chalk.dim('  dry-run: no inference performed'))
    console.log()
    return
  }

  // Build a minimal ModelConfig from what we know
  const modelConfig = buildModelConfig(selectedModelId, selectedProvider)

  try {
    const response = await callModel(modelConfig, prompt)

    if (response.error) {
      console.error(chalk.red(`  Error: ${response.error}`))
      process.exit(1)
    }

    console.log(response.text)
    console.log()
    console.log(chalk.dim(`  ${response.input_tokens + response.output_tokens} tokens | ${response.latency_ms}ms`))
    if (response.cost_usd && response.cost_usd > 0) {
      console.log(chalk.dim(`  $${response.cost_usd.toFixed(4)}`))
    }
    console.log()
  } catch (err) {
    console.error(chalk.red(`  Inference failed: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }
}

/** Build a minimal ModelConfig from model ID and provider. */
function buildModelConfig(modelId: string, provider: string): ModelConfig {
  const config: ModelConfig = {
    id: modelId,
    model: modelId,
    api_key: 'none',
    tags: [],
    port: 8080,
    timeout_ms: 120_000,
    max_tokens: 2048,
  }

  switch (provider) {
    case 'ollama': {
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
      config.base_url = host.endsWith('/v1') ? host : `${host}/v1`
      break
    }
    case 'mlx': {
      const port = process.env.MLX_PORT ?? '8080'
      config.base_url = `http://localhost:${port}/v1`
      break
    }
    case 'openrouter':
      config.base_url = 'https://openrouter.ai/api/v1'
      config.api_key = process.env.OPENROUTER_API_KEY ?? 'none'
      break
    case 'openai':
      config.base_url = 'https://api.openai.com/v1'
      config.api_key = process.env.OPENAI_API_KEY ?? 'none'
      break
    default: {
      // Try ollama as default for local models
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
      config.base_url = host.endsWith('/v1') ? host : `${host}/v1`
      break
    }
  }

  return config
}
