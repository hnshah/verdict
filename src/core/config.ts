import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { ConfigSchema, EvalPackSchema, EvalCaseSchema, type Config, type EvalPack } from '../types/index.js'

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

// Resolve provider shortcuts to base_url
function normalizeModels(config: Config): Config {
  config.models = config.models.map(m => {
    if (m.provider === 'ollama') {
      const host = m.host || process.env['OLLAMA_HOST'] || 'localhost:11434'
      return { ...m, base_url: `http://${host}/v1`, api_key: 'none' }
    }
    if (m.provider === 'mlx') {
      const port = m.port || Number(process.env['MLX_PORT']) || 8080
      return { ...m, base_url: `http://localhost:${port}/v1`, api_key: 'none' }
    }
    return m
  })
  return config
}

export function loadConfig(configPath: string): Config {
  const fullPath = path.resolve(configPath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Config not found: ${fullPath}\nRun 'verdict init' to create one.`)
  }
  const raw = yaml.load(fs.readFileSync(fullPath, 'utf8'))
  const resolved = resolveEnvVars(raw)
  const result = ConfigSchema.safeParse(resolved)
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid config:\n${issues}`)
  }
  return normalizeModels(result.data)
}

export function loadJsonlCases(jsonlPath: string): EvalPack['cases'] {
  const content = fs.readFileSync(jsonlPath, 'utf8')
  const lines = content.split('\n').filter(line => line.trim() !== '' && !line.trimStart().startsWith('//'))
  const cases: EvalPack['cases'] = []
  for (let i = 0; i < lines.length; i++) {
    let parsed: unknown
    try {
      parsed = JSON.parse(lines[i])
    } catch {
      throw new Error(`Invalid JSON at ${jsonlPath} line ${i + 1}`)
    }
    const result = EvalCaseSchema.safeParse(parsed)
    if (!result.success) {
      const issues = result.error.issues.map(iss => `${iss.path.join('.')}: ${iss.message}`).join(', ')
      throw new Error(`Invalid eval case at ${jsonlPath} line ${i + 1}: ${issues}`)
    }
    cases.push(result.data)
  }
  return cases
}

export function loadEvalPack(packPath: string, configDir: string): EvalPack {
  const fullPath = path.isAbsolute(packPath)
    ? packPath
    : path.resolve(configDir, packPath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Eval pack not found: ${fullPath}`)
  }
  const raw = yaml.load(fs.readFileSync(fullPath, 'utf8'))
  const result = EvalPackSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid eval pack ${packPath}:\n${issues}`)
  }

  const pack = result.data
  const packDir = path.dirname(fullPath)

  // Load JSONL dataset if specified
  if (pack.dataset) {
    const datasetPath = path.isAbsolute(pack.dataset)
      ? pack.dataset
      : path.resolve(packDir, pack.dataset)
    if (!fs.existsSync(datasetPath)) {
      throw new Error(`Dataset file not found: ${datasetPath} (referenced in ${packPath})`)
    }
    const jsonlCases = loadJsonlCases(datasetPath)
    pack.cases = [...pack.cases, ...jsonlCases]
  }

  // Resolve image paths relative to pack file directory
  for (const evalCase of pack.cases) {
    if (evalCase.image && !evalCase.image.startsWith('http://') && !evalCase.image.startsWith('https://')) {
      evalCase.image = path.resolve(packDir, evalCase.image)
    }
  }

  return pack
}
