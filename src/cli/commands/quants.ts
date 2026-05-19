/**
 * verdict quants <base> — compare all installed Ollama quantizations of a
 * base model on the quantization eval pack.
 *
 * Example:
 *   verdict quants qwen2.5:7b
 *   → finds qwen2.5:7b-q4_K_M, qwen2.5:7b-q2_K, qwen2.5:7b-q8_0 (whatever is
 *     installed), runs all of them against eval-packs/quantization.yaml,
 *     and prints a focused frontier table.
 *
 * Goal: answer "did 2-bit break it?" in one command.
 */

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { listOllamaModels } from '../../providers/ollama.js'
import { loadConfig, loadEvalPack } from '../../core/config.js'
import { runEvals } from '../../core/runner.js'
import { printVerdict, printSummary } from '../../reporter/terminal.js'
import { buildModelConfig } from '../../utils/model-config.js'
import type { Config, ModelConfig, ModelSummary } from '../../types/index.js'

export interface QuantsOptions {
  /** Path to verdict.yaml — only used to inherit the judge config. */
  config: string
  /** Eval pack to run. Default: eval-packs/quantization.yaml */
  pack?: string
  /** Ollama host. */
  host?: string
}

export async function quantsCommand(basePattern: string, opts: QuantsOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' quants ') + chalk.cyan(basePattern))
  console.log()

  const host = opts.host ?? process.env['OLLAMA_HOST']?.replace(/^https?:\/\//, '') ?? 'localhost:11434'
  const installed = await listOllamaModels(host)
  if (installed.length === 0) {
    console.error(chalk.red(`  No Ollama models found at ${host}.`))
    console.error(chalk.dim('  → Start Ollama with `ollama serve` and pull some models.'))
    process.exit(1)
  }

  // Match installed models that share the base name (case-insensitive prefix).
  const baseLower = basePattern.toLowerCase()
  const variants = installed.filter(m => m.toLowerCase().startsWith(baseLower))
  if (variants.length < 2) {
    console.error(chalk.red(`  Need at least 2 installed quants matching "${basePattern}". Found ${variants.length}.`))
    if (variants.length === 1) {
      console.error(chalk.dim(`  → Installed: ${variants[0]}`))
      console.error(chalk.dim(`  → Pull another quant, e.g. \`ollama pull ${basePattern}:q4_K_M\` or \`:q2_K\`.`))
    } else {
      console.error(chalk.dim(`  → \`ollama list\` to see what's installed.`))
    }
    process.exit(1)
  }

  console.log(chalk.dim(`  Found ${variants.length} quants:`))
  for (const v of variants) console.log(chalk.dim(`    • ${v}`))
  console.log()

  // Load base config for judge settings.
  let baseConfig: Config
  try {
    baseConfig = loadConfig(opts.config)
  } catch (err) {
    console.error(chalk.red(`  Failed to load ${opts.config}: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  // Build a synthetic config: same judge, but models = the variants.
  const modelConfigs: ModelConfig[] = variants.map(v => ({
    ...buildModelConfig(v, 'ollama'),
    provider: 'ollama' as const,
  }))

  // Pick the pack. Default to quantization.yaml; fall back to general.yaml.
  const packPath = opts.pack
    ?? (fs.existsSync(path.resolve('./eval-packs/quantization.yaml'))
        ? './eval-packs/quantization.yaml'
        : './eval-packs/general.yaml')

  let pack
  try {
    pack = loadEvalPack(packPath, path.dirname(path.resolve(opts.config)))
  } catch (err) {
    console.error(chalk.red(`  Failed to load pack ${packPath}: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }
  console.log(chalk.dim(`  Pack: ${pack.name} (${pack.cases.length} cases)`))
  console.log()

  const config: Config = {
    ...baseConfig,
    models: modelConfigs,
    packs: [packPath],
  }

  const spinner = ora({ prefixText: '  ', text: 'Running...' }).start()
  let result
  try {
    result = await runEvals(config, [pack], () => {}, false, undefined, true)
    spinner.succeed('Done')
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  // Headline + quant-specific frontier.
  printVerdict(result)
  printSummary(result)
  printQuantFrontier(result.models.map(id => result.summary[id]).filter(Boolean))
}

/**
 * Quant-specific frontier: emphasize latency + score tradeoff because
 * size/quality differences across quants are the whole point.
 */
function printQuantFrontier(summaries: ModelSummary[]): void {
  if (summaries.length === 0) return
  const sorted = summaries.sort((a, b) => b.avg_total - a.avg_total)
  const best = sorted[0]
  const fastest = [...summaries].sort((a, b) => a.avg_latency_ms - b.avg_latency_ms)[0]

  console.log(chalk.bold('  Quant frontier'))
  console.log(chalk.dim('  ' + '-'.repeat(60)))
  console.log(chalk.green(`    Highest quality: ${best.model_id}`) + chalk.dim(` (${best.avg_total.toFixed(2)}/10, ${(best.avg_latency_ms / 1000).toFixed(2)}s)`))
  if (fastest.model_id !== best.model_id) {
    const qualityGap = +(best.avg_total - fastest.avg_total).toFixed(2)
    const speedup = +(best.avg_latency_ms / fastest.avg_latency_ms).toFixed(2)
    console.log(chalk.yellow(`    Fastest:         ${fastest.model_id}`) + chalk.dim(` (${fastest.avg_total.toFixed(2)}/10, ${(fastest.avg_latency_ms / 1000).toFixed(2)}s) — ${speedup}× faster, -${qualityGap}pts`))
    if (qualityGap < 0.5) {
      console.log(chalk.green(`    → ${fastest.model_id} is within ${qualityGap}pts of the best at ${speedup}× the speed. Use it.`))
    } else {
      console.log(chalk.yellow(`    → ${best.model_id} earns its latency: quality drop to the fastest is ${qualityGap}pts.`))
    }
  } else {
    console.log(chalk.green(`    Best is also fastest — pick ${best.model_id}.`))
  }
  console.log()
}
