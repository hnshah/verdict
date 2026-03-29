import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import chalk from 'chalk'
import { ConfigSchema } from '../../types/index.js'
import { EvalPackSchema } from '../../types/index.js'

function resolveEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}:]+)(?::-(.*?))?\}/g, (_, name, fallback) => {
      return process.env[name] ?? fallback ?? ''
    })
  }
  if (Array.isArray(value)) return value.map(resolveEnvVars)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, resolveEnvVars(v)])
    )
  }
  return value
}

interface ValidateOptions {
  config: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  summary: {
    models: number
    packs: number
    scorers: Set<string>
  }
}

function getPackageVersion(): string {
  try {
    const pkgPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../package.json'
    )
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export function validateConfig(configPath: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const summary = { models: 0, packs: 0, scorers: new Set<string>() }

  // 1. Check file exists
  const fullPath = path.resolve(configPath)
  if (!fs.existsSync(fullPath)) {
    errors.push(`Config file not found: ${fullPath}`)
    return { valid: false, errors, warnings, summary }
  }

  // 2. Parse YAML
  let raw: unknown
  try {
    raw = yaml.load(fs.readFileSync(fullPath, 'utf8'))
  } catch (e) {
    const yamlErr = e as yaml.YAMLException
    const line = yamlErr.mark?.line != null ? ` (line ${yamlErr.mark.line + 1})` : ''
    errors.push(`YAML syntax error${line}: ${yamlErr.reason || yamlErr.message}`)
    return { valid: false, errors, warnings, summary }
  }

  // 3. Resolve env vars and validate against Zod schema
  const resolved = resolveEnvVars(raw)
  const result = ConfigSchema.safeParse(resolved)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const pathStr = issue.path.join('.')
      errors.push(`Schema error at ${pathStr}: ${issue.message}`)
    }
    return { valid: false, errors, warnings, summary }
  }

  const config = result.data

  // 3b. Check config version compatibility
  if (config.version) {
    const configMajor = config.version.split('.')[0]
    const pkgVersion = getPackageVersion()
    const pkgMajor = pkgVersion.split('.')[0]
    if (configMajor !== pkgMajor) {
      warnings.push(`Config version ${config.version} may not be compatible with verdict ${pkgVersion}`)
    }
  }
  summary.models = config.models.length
  summary.packs = config.packs.length

  // 4. Check model providers
  for (const model of config.models) {
    if (!model.provider && !model.base_url) {
      errors.push(`Model "${model.id}": needs either 'provider' (ollama/mlx) or 'base_url'`)
    }
  }

  // 5. Check judge model references a configured model
  const modelIds = new Set(config.models.map(m => m.id))
  if (!modelIds.has(config.judge.model)) {
    errors.push(`Judge model "${config.judge.model}" is not in the models list`)
  }

  // 6. Validate referenced eval packs exist and parse correctly
  const configDir = path.dirname(fullPath)
  for (const packPath of config.packs) {
    const packFullPath = path.isAbsolute(packPath)
      ? packPath
      : path.resolve(configDir, packPath)

    if (!fs.existsSync(packFullPath)) {
      errors.push(`Eval pack not found: ${packPath}`)
      continue
    }

    try {
      const packRaw = yaml.load(fs.readFileSync(packFullPath, 'utf8'))
      const packResult = EvalPackSchema.safeParse(packRaw)
      if (!packResult.success) {
        for (const issue of packResult.error.issues) {
          errors.push(`Pack "${packPath}" → ${issue.path.join('.')}: ${issue.message}`)
        }
      } else {
        for (const c of packResult.data.cases) {
          summary.scorers.add(c.scorer)
        }
      }
    } catch (e) {
      const yamlErr = e as yaml.YAMLException
      errors.push(`Pack "${packPath}": YAML parse error — ${yamlErr.reason || yamlErr.message}`)
    }
  }

  return { valid: errors.length === 0, errors, warnings, summary }
}

export async function validateCommand(opts: ValidateOptions): Promise<void> {
  console.log(chalk.bold('\n  verdict') + chalk.dim(' validate\n'))

  const { valid, errors, warnings, summary } = validateConfig(opts.config)

  if (valid) {
    console.log(chalk.green('  ✅ Config valid') + chalk.dim(` — ${opts.config}\n`))
    for (const warn of warnings) {
      console.log(chalk.yellow(`  ⚠ ${warn}`))
    }
    console.log(chalk.dim('  Summary:'))
    console.log(chalk.dim(`    Models:  ${summary.models}`))
    console.log(chalk.dim(`    Packs:   ${summary.packs}`))
    console.log(chalk.dim(`    Scorers: ${[...summary.scorers].join(', ') || 'none (no packs loaded)'}`))
    console.log()
  } else {
    console.log(chalk.red(`  ❌ Config invalid`) + chalk.dim(` — ${opts.config}\n`))
    for (const err of errors) {
      console.log(chalk.red(`  • ${err}`))
    }
    console.log()
    process.exit(1)
  }
}
