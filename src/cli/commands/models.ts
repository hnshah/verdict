import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import chalk from 'chalk'
import ora from 'ora'
import yaml from 'js-yaml'
import { z } from 'zod'
import { loadConfig } from '../../core/config.js'
import { checkFit, detectHardware } from '../../core/hardware.js'
import { pingModel } from '../../providers/compat.js'
import { discoverOllama, isOllamaRunning, listOllamaModels } from '../../providers/ollama.js'
import { discoverMLX, isMLXRunning } from '../../providers/mlx.js'
import { discoverLMStudio, isLMStudioRunning } from '../../providers/lmstudio.js'
import type { DiscoveredModel } from '../../types/index.js'

interface ModelsOptions { config: string }
interface DiscoverOptions { json?: boolean }
interface CatalogOptions { catalog?: string; json?: boolean }
interface SuggestOptions { config: string; catalog?: string; json?: boolean }
interface AutoPullOptions { catalog?: string; maxSize: string; dryRun?: boolean; json?: boolean }

const CatalogModelSchema = z.object({
  name: z.string(),
  provider: z.enum(['ollama', 'mlx']),
  params_b: z.number().positive(),
  default_quant: z.string(),
  family: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

const ModelCatalogSchema = z.object({
  version: z.string(),
  models: z.array(CatalogModelSchema).default([]),
})

type CatalogModel = z.infer<typeof CatalogModelSchema>
type CatalogEntry = CatalogModel & {
  fit: ReturnType<typeof checkFit>
}

function loadModelCatalog(catalogPath = './configs/model-catalog.yaml'): CatalogModel[] {
  const fullPath = path.resolve(catalogPath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Model catalog not found: ${fullPath}`)
  }

  const raw = yaml.load(fs.readFileSync(fullPath, 'utf8'))
  const parsed = ModelCatalogSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid model catalog:\n${issues}`)
  }

  return parsed.data.models
}

function modelIdFromName(name: string, provider: string): string {
  if (provider === 'ollama') return name
  return (name.split('/').pop() ?? name).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

function catalogWithFit(catalogPath?: string): { entries: CatalogEntry[]; hardware: ReturnType<typeof detectHardware> } {
  const hardware = detectHardware()
  const entries = loadModelCatalog(catalogPath).map(model => ({
    ...model,
    fit: checkFit(
      { name: model.name, params_b: model.params_b, quant: model.default_quant },
      hardware
    ),
  }))
  return { entries, hardware }
}

function yamlSnippet(model: CatalogModel): string {
  const id = modelIdFromName(model.name, model.provider)
  const tags = model.tags.length ? `\n    tags: [${model.tags.join(', ')}]` : ''
  return [
    `  - id: ${id}`,
    `    provider: ${model.provider}`,
    `    model: ${model.name}${tags}`,
  ].join('\n')
}

async function discoverAllModels(): Promise<DiscoveredModel[]> {
  const ollamaHosts = ['localhost:11434']
  const envHost = process.env['OLLAMA_HOST']
  if (envHost && !ollamaHosts.includes(envHost)) ollamaHosts.push(envHost)

  const mlxPort = Number(process.env['MLX_PORT']) || 8080
  const lmPort = Number(process.env['LMSTUDIO_PORT']) || 1234

  const [ollama, mlx, lmstudio] = await Promise.all([
    discoverOllama(ollamaHosts),
    discoverMLX([mlxPort]),
    discoverLMStudio('localhost', lmPort),
  ])

  return [...ollama, ...mlx, ...lmstudio]
}

function runOllamaPull(model: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ollama', ['pull', model], { stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`ollama pull exited with code ${code}`))
    })
  })
}

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

export async function discoverCommand(opts: DiscoverOptions = {}): Promise<void> {
  if (opts.json) {
    const models = await discoverAllModels()
    process.stdout.write(JSON.stringify(models, null, 2) + '\n')
    return
  }

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
  let foundMoE = false

  if (mlxRunning) {
    const models = await discoverMLX([mlxPort])
    console.log(chalk.green(`  MLX           localhost:${mlxPort}      running (Apple Silicon)`))
    for (const m of models) {
      const moeTag = m.is_moe ? chalk.cyan(' [MoE]') : ''
      console.log(`    ${m.model.padEnd(50)}${moeTag}`)
      if (m.is_moe) foundMoE = true
    }
    if (models.length > 0) {
      console.log()
      console.log(chalk.dim('  Add to verdict.yaml:'))
      for (const m of models.slice(0, 2)) {
        const concurrency = m.is_moe ? 1 : 2
        const timeout = m.is_moe ? 180000 : 60000
        const moeComment = m.is_moe ? '  # MoE: use concurrency:1, long timeout' : ''
        console.log(chalk.dim(`    - id: ${m.id}${moeComment}`))
        console.log(chalk.dim(`      provider: mlx`))
        console.log(chalk.dim(`      model: ${m.model}`))
        console.log(chalk.dim(`      tags: [${m.tags.join(', ')}]`))
        if (m.is_moe) {
          console.log(chalk.dim(`      timeout_ms: ${timeout}  # MoE models are slow — give them time`))
          console.log(chalk.dim(`  # In run config: concurrency: ${concurrency}  # avoid memory pressure`))
        }
      }
    }
  } else {
    console.log(chalk.dim(`  MLX           localhost:${mlxPort}      not running`))
    console.log(chalk.dim('    Start: mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit'))
  }

  // Ollama MoE routing hint
  const ollamaHosts2 = ['localhost:11434']
  const ollamaRunning2 = await isOllamaRunning(ollamaHosts2[0])
  if (ollamaRunning2) {
    const ollamaModels = await discoverOllama(ollamaHosts2)
    if (ollamaModels.some(m => m.is_moe)) foundMoE = true
  }

  if (foundMoE) {
    console.log()
    console.log(chalk.cyan('  MoE models detected.'))
    console.log(chalk.dim('  Run the MoE benchmark to see expert-switching advantages vs dense models:'))
    console.log(chalk.dim('    verdict run --pack moe'))
    console.log(chalk.dim('  Tip: also run general.yaml on a comparable dense model to see the delta.'))
  }

  // LM Studio
  const lmPort = Number(process.env['LMSTUDIO_PORT']) || 1234
  const lmRunning = await isLMStudioRunning('localhost', lmPort)

  if (lmRunning) {
    const models = await discoverLMStudio('localhost', lmPort)
    console.log(chalk.green(`  LM Studio     localhost:${lmPort}      running (GGUF)`))
    if (models.length === 0) {
      console.log(chalk.dim('    No LLM models loaded. Open LM Studio app or run: lms load <model>'))
    }
    for (const m of models) {
      const size = m.size_gb ? chalk.dim(` ${m.size_gb}GB`) : ''
      const ctx = m.context_window ? chalk.dim(` ctx:${m.context_window}`) : ''
      console.log(`    ${(m.display_name ?? m.model).padEnd(35)}${size}${ctx}`)
    }
    if (models.length > 0) {
      console.log()
      console.log(chalk.dim('  Add to verdict.yaml:'))
      for (const m of models.slice(0, 3)) {
        console.log(chalk.dim(`    - id: ${m.id}`))
        console.log(chalk.dim(`      provider: lmstudio`))
        console.log(chalk.dim(`      model: ${m.model}`))
        console.log(chalk.dim(`      base_url: http://localhost:${lmPort}/v1`))
        console.log(chalk.dim(`      tags: [${m.tags.join(', ')}]`))
      }
    }
  } else {
    console.log(chalk.dim(`  LM Studio     localhost:${lmPort}      not running`))
    console.log(chalk.dim('    Start: lms daemon up && lms server start'))  
  }

  console.log()
}

export async function catalogCommand(opts: CatalogOptions = {}): Promise<void> {
  let result
  try {
    result = catalogWithFit(opts.catalog)
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  const { entries, hardware } = result

  if (opts.json) {
    process.stdout.write(JSON.stringify({ hardware, models: entries }, null, 2) + '\n')
    return
  }

  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' models catalog'))
  console.log(chalk.dim(`  Hardware: ${hardware.ramGB} GB RAM${hardware.freeDiskGB !== undefined ? `, ${hardware.freeDiskGB} GB free disk` : ''}`))
  console.log()
  console.log(chalk.dim(`  ${'Provider'.padEnd(8)} ${'Model'.padEnd(55)} ${'Size'.padEnd(7)} ${'Quant'.padEnd(8)} Fit`))

  for (const entry of entries) {
    const status = entry.fit.fits
      ? chalk.green('fit')
      : chalk.red(`skip - ${entry.fit.reason}`)
    console.log(
      `  ${entry.provider.padEnd(8)} ${entry.name.padEnd(55)} ${String(entry.params_b + 'B').padEnd(7)} ${entry.default_quant.padEnd(8)} ${status}`
    )
  }

  console.log()
}

export async function suggestCommand(opts: SuggestOptions): Promise<void> {
  let config
  let entries: CatalogEntry[]
  try {
    config = loadConfig(opts.config)
    entries = catalogWithFit(opts.catalog).entries
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  const configured = new Set<string>()
  for (const model of config.models) {
    configured.add(model.id)
    configured.add(model.model)
  }

  const suggestions = entries
    .filter(entry => entry.fit.fits)
    .filter(entry => !configured.has(entry.name) && !configured.has(modelIdFromName(entry.name, entry.provider)))
    .sort((a, b) => a.params_b - b.params_b || a.name.localeCompare(b.name))

  if (opts.json) {
    process.stdout.write(JSON.stringify({ suggestions }, null, 2) + '\n')
    return
  }

  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' models suggest'))
  console.log()

  if (suggestions.length === 0) {
    console.log(chalk.dim('  No fitting catalog models are missing from verdict.yaml.'))
    console.log()
    return
  }

  for (const entry of suggestions) {
    console.log(`  ${chalk.green(entry.name)} ${chalk.dim(`${entry.params_b}B ${entry.default_quant}`)}`)
    console.log(chalk.dim(`    ${entry.fit.needs_gb} GB RAM needed, ${entry.fit.available_gb} GB available`))
  }

  console.log()
  console.log(chalk.dim('  Add to verdict.yaml:'))
  console.log('models:')
  for (const entry of suggestions.slice(0, 10)) {
    console.log(yamlSnippet(entry))
  }
  if (suggestions.length > 10) {
    console.log(chalk.dim(`  # ${suggestions.length - 10} more suggestions omitted`))
  }
  console.log()
}

export async function autoPullCommand(opts: AutoPullOptions): Promise<void> {
  const maxSize = Number(opts.maxSize)
  if (!Number.isFinite(maxSize) || maxSize <= 0) {
    console.error(chalk.red('  --max-size must be a positive number of billions of parameters'))
    process.exit(1)
  }

  let entries: CatalogEntry[]
  try {
    entries = catalogWithFit(opts.catalog).entries
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  const ollamaHost = process.env['OLLAMA_HOST'] || 'localhost:11434'
  const installed = new Set(await listOllamaModels(ollamaHost))
  const pulled: string[] = []
  const wouldPull: string[] = []
  const alreadyInstalled: string[] = []
  const manual: string[] = []
  const skipped: Array<{ name: string; reason: string; needs_gb: number; available_gb: number }> = []
  const failed: Array<{ name: string; error: string }> = []

  const candidates = entries
    .filter(entry => entry.provider === 'ollama')
    .sort((a, b) => a.params_b - b.params_b || a.name.localeCompare(b.name))

  if (!opts.json) {
    console.log()
    console.log(chalk.bold('  verdict') + chalk.dim(' models auto-pull'))
    console.log(chalk.dim(`  Max auto-pull size: ${maxSize}B`))
    console.log()
  }

  for (const entry of candidates) {
    if (!entry.fit.fits) {
      skipped.push({
        name: entry.name,
        reason: entry.fit.reason ?? 'does not fit this hardware',
        needs_gb: entry.fit.needs_gb,
        available_gb: entry.fit.available_gb,
      })
      if (!opts.json) console.log(chalk.dim(`  skip ${entry.name}: ${entry.fit.reason}`))
      continue
    }

    if (installed.has(entry.name)) {
      alreadyInstalled.push(entry.name)
      if (!opts.json) console.log(chalk.dim(`  installed ${entry.name}`))
      continue
    }

    if (entry.params_b > maxSize) {
      manual.push(entry.name)
      if (!opts.json) console.log(chalk.yellow(`  consider manually pulling ${entry.name} (${entry.params_b}B > ${maxSize}B cap)`))
      continue
    }

    if (opts.dryRun) {
      wouldPull.push(entry.name)
      if (!opts.json) console.log(chalk.cyan(`  would pull ${entry.name}`))
      continue
    }

    if (!opts.json) console.log(chalk.cyan(`  pulling ${entry.name}...`))
    try {
      await runOllamaPull(entry.name)
      pulled.push(entry.name)
      installed.add(entry.name)
    } catch (err) {
      failed.push({ name: entry.name, error: err instanceof Error ? err.message : String(err) })
      if (!opts.json) console.log(chalk.red(`  failed ${entry.name}: ${err instanceof Error ? err.message : err}`))
    }
  }

  const summary = {
    pulled,
    would_pull: wouldPull,
    already_installed: alreadyInstalled,
    consider_manual: manual,
    skipped,
    failed,
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
    return
  }

  console.log()
  console.log(chalk.bold('  Summary'))
  console.log(`  pulled: ${pulled.length}`)
  if (opts.dryRun) console.log(`  would pull: ${wouldPull.length}`)
  console.log(`  installed: ${alreadyInstalled.length}`)
  console.log(`  manual: ${manual.length}`)
  console.log(`  skipped: ${skipped.length}`)
  console.log(`  failed: ${failed.length}`)
  console.log()
}
