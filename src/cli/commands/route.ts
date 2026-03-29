/**
 * `verdict route` command — select and query the best model using eval history.
 */

import chalk from 'chalk'
import { getDb, initSchema } from '../../db/client.js'
import { selectModel } from '../../router/selector.js'
import { callModel } from '../../providers/compat.js'
import type { ModelConfig } from '../../types/index.js'
import { buildModelConfig } from '../../utils/model-config.js'

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
      console.error(chalk.red('  ❌ No model found matching criteria'))
      console.log()
      console.log(chalk.yellow('  💡 Next steps:'))
      console.log(chalk.dim('     1. Run `verdict init` to create verdict.yaml'))
      console.log(chalk.dim('     2. Configure your models in verdict.yaml'))
      console.log(chalk.dim('     3. Run `verdict run` to build eval history'))
      console.log(chalk.dim('     4. Then try `verdict route` again'))
      console.log()
      if (opts.type || opts.prefer || opts.minScore) {
        console.log(chalk.dim('  Or try without filters: verdict route "your prompt"'))
        console.log()
      }
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

