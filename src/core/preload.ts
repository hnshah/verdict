import type { ModelConfig } from '../types/index.js'
import { callModel } from '../providers/compat.js'
import chalk from 'chalk'

const progress = (...args: unknown[]) => console.error(...args)

export interface PreloadResult {
  model: string
  success: boolean
  duration: number
  error?: string
}

/**
 * Check if a model needs pre-loading
 */
export function needsPreload(model: ModelConfig): boolean {
  // Only Ollama models need pre-loading
  // MLX, cloud providers, and other endpoints are instant
  return model.provider === 'ollama'
}

/**
 * Pre-load a single model by making a tiny API call
 */
export async function preloadModel(
  model: ModelConfig,
  verbose: boolean = false
): Promise<PreloadResult> {
  const start = Date.now()
  
  try {
    // Make tiny call to load model into memory
    // Using "1+1=?" as minimal prompt (4 tokens)
    await callModel(model, '1+1=?')
    
    const duration = Date.now() - start
    return {
      model: model.id,
      success: true,
      duration
    }
  } catch (err: any) {
    const duration = Date.now() - start
    return {
      model: model.id,
      success: false,
      duration,
      error: err.message || String(err)
    }
  }
}

/**
 * Pre-load all models that need it
 */
export async function preloadModels(
  models: ModelConfig[],
  verbose: boolean = false
): Promise<PreloadResult[]> {
  // Filter to only models that need pre-loading
  const modelsToLoad = models.filter(needsPreload)
  
  if (modelsToLoad.length === 0) {
    if (verbose) {
      progress(chalk.dim('  No models need pre-loading'))
    }
    return []
  }

  progress()
  progress(chalk.bold('Pre-loading models...'))
  
  const results: PreloadResult[] = []
  
  // Load sequentially (parallel might overload system)
  for (const model of modelsToLoad) {
    const result = await preloadModel(model, verbose)
    results.push(result)
    
    if (result.success) {
      const timeStr = (result.duration / 1000).toFixed(1) + 's'
      progress(chalk.green('  ✓'), model.id, chalk.dim(`(${timeStr})`))
    } else {
      progress(chalk.red('  ✗'), model.id, chalk.dim(`- ${result.error}`))
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success).length
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0) / 1000
  
  progress()
  if (successful === results.length) {
    progress(chalk.green(`All models ready`) + chalk.dim(` (${totalTime.toFixed(1)}s total)`))
  } else {
    const failed = results.length - successful
    progress(chalk.yellow(`${successful}/${results.length} models ready`) + chalk.dim(` (${failed} failed)`))
    
    // Check if any critical failures
    const criticalErrors = results.filter(r => !r.success && (
      r.error?.includes('not found') ||
      r.error?.includes('not installed') ||
      r.error?.includes('ECONNREFUSED')
    ))
    
    if (criticalErrors.length > 0) {
      progress()
      progress(chalk.red('Critical errors:'))
      for (const err of criticalErrors) {
        progress(chalk.red('  •'), err.model + ':', err.error)
      }
      progress()
      progress(chalk.yellow('Fix these issues before running evals.'))
      progress()
      process.exit(1)
    }
  }
  
  progress()
  return results
}
