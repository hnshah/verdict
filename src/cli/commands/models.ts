import chalk from 'chalk'
import ora from 'ora'
import { loadConfig } from '../../core/config.js'
import { pingModel } from '../../providers/compat.js'
import { discoverOllama, isOllamaRunning } from '../../providers/ollama.js'
import { discoverMLX, isMLXRunning, mlxStartCommand } from '../../providers/mlx.js'

interface ModelsOptions { config: string }

export async function modelsCommand(opts: ModelsOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' models'))
  console.log()

  let config
  try {
    config = loadConfig(opts.config)
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  for (const model of config.models) {
    const label = `  ${model.id.padEnd(22)} ${chalk.dim((model.base_url ?? '').slice(0, 40))}`
    const spinner = ora({ text: label, prefixText: '' }).start()
    const result = await pingModel(model)
    if (result.ok) {
      spinner.succeed(chalk.green(`  ${model.id.padEnd(22)}`) + chalk.dim(` ${(model.base_url ?? '').slice(0, 40).padEnd(42)}`) + chalk.green(`  ${result.latency_ms}ms`))
    } else {
      spinner.fail(chalk.red(`  ${model.id.padEnd(22)}`) + chalk.dim(` ${(model.base_url ?? '').slice(0, 40).padEnd(42)}`) + chalk.red(`  ${result.error ?? 'failed'}`))
    }
  }
  console.log()
}

export async function discoverCommand(): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' models discover'))
  console.log(chalk.dim('  Scanning for local inference servers...'))
  console.log()

  // Ollama
  const ollamaHosts = ['localhost:11434']
  const envHost = process.env['OLLAMA_HOST']
  if (envHost && !ollamaHosts.includes(envHost)) ollamaHosts.push(envHost)

  const ollamaRunning = await isOllamaRunning(ollamaHosts[0])
  if (ollamaRunning) {
    const models = await discoverOllama(ollamaHosts)
    console.log(chalk.green(`  Ollama        localhost:11434   running`))
    if (models.length === 0) {
      console.log(chalk.dim('    No models installed. Run: ollama pull qwen2.5:7b'))
    }
    for (const m of models) {
      const moeTag = m.is_moe ? chalk.cyan(' [MoE]') : ''
      const size = m.size_gb ? chalk.dim(` ${m.size_gb}GB`) : ''
      console.log(`    ${m.model.padEnd(35)}${size}${moeTag}`)
    }
    if (models.length > 0) {
      console.log()
      console.log(chalk.dim('  Add to verdict.yaml:'))
      for (const m of models.slice(0, 3)) {
        const moeComment = m.is_moe ? '  # MoE model' : ''
        console.log(chalk.dim(`    - id: ${m.id}`))
        console.log(chalk.dim(`      provider: ollama`))
        console.log(chalk.dim(`      model: ${m.model}${moeComment}`))
        console.log(chalk.dim(`      tags: [${m.tags.join(', ')}]`))
      }
    }
  } else {
    console.log(chalk.dim('  Ollama        localhost:11434   not running'))
    console.log(chalk.dim('    Start: ollama serve'))
  }

  console.log()

  // MLX
  const mlxPort = Number(process.env['MLX_PORT']) || 8080
  const mlxRunning = await isMLXRunning(mlxPort)
  if (mlxRunning) {
    const models = await discoverMLX([mlxPort])
    console.log(chalk.green(`  MLX           localhost:${mlxPort}      running (Apple Silicon)`))
    for (const m of models) {
      const moeTag = m.is_moe ? chalk.cyan(' [MoE]') : ''
      console.log(`    ${m.model.padEnd(50)}${moeTag}`)
    }
  } else {
    console.log(chalk.dim(`  MLX           localhost:${mlxPort}      not running`))
    console.log(chalk.dim('    Start: mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit'))
  }

  console.log()
  console.log(chalk.dim('  LM Studio     localhost:1234    not checked (add --all to scan)'))
  console.log()
}
