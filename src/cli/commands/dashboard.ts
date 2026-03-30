import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import type { RunResult } from '../../types/index.js'

// ─── Dashboard data types ────────────────────────────────────────────────────

export interface DashboardMeta {
  total_runs: number
  total_cases: number
  total_models: number
  last_updated: string
}

export interface DashboardModel {
  name: string
}

export interface DashboardResponse {
  text: string
  latency_ms: number
}

export interface DashboardScore {
  total: number
  reasoning: string
  dimensions?: {
    accuracy: number
    completeness: number
    conciseness: number
  }
  structured_reasoning?: {
    strengths: string[]
    weaknesses: string[]
    verdict: string
  }
}

export interface DashboardRunMeta {
  run_id: string
  config_file?: string
  verdict_version?: string
  hardware?: string
}

export interface DashboardRun {
  run_id: string
  run_meta?: DashboardRunMeta
  responses: Record<string, DashboardResponse>
  scores: Record<string, DashboardScore>
}

export interface DashboardCase {
  id: string
  name: string
  suite: string
  prompt: string
  runs: DashboardRun[]
}

export interface DashboardData {
  meta: DashboardMeta
  models: Record<string, DashboardModel>
  cases: DashboardCase[]
}

// ─── Options ─────────────────────────────────────────────────────────────────

interface GenerateOptions {
  output: string
  results: string
  embed?: boolean
}

interface ValidateOptions {
  input: string
}

interface PreviewOptions {
  input?: string
  port: string
}

interface ServeOptions {
  results: string
  port: string
}

interface DeployOptions {
  to: string
  results: string
  output: string
}

// ─── Generate command ────────────────────────────────────────────────────────

export async function dashboardGenerateCommand(opts: GenerateOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' dashboard generate'))
  console.log()

  const resultsDir = path.resolve(opts.results)
  if (!fs.existsSync(resultsDir)) {
    console.error(chalk.red(`  ✗ Results directory not found: ${opts.results}`))
    process.exit(1)
  }

  const spinner = ora('Scanning results...').start()

  const files = fs.readdirSync(resultsDir)
    .filter(f => f.endsWith('.json'))

  if (files.length === 0) {
    spinner.fail('No result JSON files found')
    console.log()
    console.log(chalk.dim('  Run some evals first:'))
    console.log(`    ${chalk.cyan('verdict run')}`)
    console.log()
    process.exit(1)
  }

  spinner.text = `Processing ${files.length} result file(s)...`

  const dashboardData = aggregateResults(resultsDir, files)

  spinner.succeed(`Processed ${files.length} result(s)`)

  // Write output
  const outputPath = path.resolve(opts.output)
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  if (opts.embed) {
    // Embed data into HTML template
    const templatePath = path.resolve(__dirname, '../../../dashboard/templates/index.html')
    let template: string
    // Try bundled template, fall back to source location
    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, 'utf-8')
    } else {
      // When running from src with tsx, templates are at project root
      const altPath = path.resolve(__dirname, '../../../../dashboard/templates/index.html')
      if (fs.existsSync(altPath)) {
        template = fs.readFileSync(altPath, 'utf-8')
      } else {
        spinner.fail('Dashboard template not found')
        process.exit(1)
      }
    }

    const htmlOutput = outputPath.replace(/\.json$/, '.html')
    const html = template.replace(
      '/*__DASHBOARD_DATA__*/null',
      JSON.stringify(dashboardData)
    )
    fs.writeFileSync(htmlOutput, html)
    console.log(chalk.green(`  ✓ Dashboard HTML: ${chalk.cyan(htmlOutput)}`))
  }

  fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2))

  console.log(chalk.green(`  ✓ Dashboard data: ${chalk.cyan(outputPath)}`))
  console.log()
  console.log(chalk.dim('  Stats:'))
  console.log(`    Models: ${chalk.bold(String(dashboardData.meta.total_models))}`)
  console.log(`    Cases:  ${chalk.bold(String(dashboardData.meta.total_cases))}`)
  console.log(`    Runs:   ${chalk.bold(String(dashboardData.meta.total_runs))}`)
  console.log()
}

// ─── Validate command ────────────────────────────────────────────────────────

export async function dashboardValidateCommand(opts: ValidateOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' dashboard validate'))
  console.log()

  const inputPath = path.resolve(opts.input)
  if (!fs.existsSync(inputPath)) {
    console.error(chalk.red(`  ✗ File not found: ${opts.input}`))
    process.exit(1)
  }

  let data: unknown
  try {
    data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  } catch (err) {
    console.error(chalk.red(`  ✗ Invalid JSON: ${err}`))
    process.exit(1)
  }

  const errors = validateDashboardData(data)

  if (errors.length === 0) {
    console.log(chalk.green('  ✓ Dashboard data is valid!'))
    const d = data as DashboardData
    console.log()
    console.log(chalk.dim('  Stats:'))
    console.log(`    Models: ${chalk.bold(String(Object.keys(d.models).length))}`)
    console.log(`    Cases:  ${chalk.bold(String(d.cases.length))}`)
    console.log(`    Runs:   ${chalk.bold(String(d.meta.total_runs))}`)
  } else {
    console.error(chalk.red(`  ✗ ${errors.length} validation error(s):`))
    for (const err of errors) {
      console.error(chalk.red(`    • ${err}`))
    }
    process.exit(1)
  }
  console.log()
}

// ─── Preview command ─────────────────────────────────────────────────────────

export async function dashboardPreviewCommand(opts: PreviewOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' dashboard preview'))
  console.log()

  const inputPath = path.resolve(opts.input || 'dashboard-data.json')
  if (!fs.existsSync(inputPath)) {
    console.error(chalk.red(`  ✗ File not found: ${inputPath}`))
    console.log(chalk.dim('  Generate data first:'))
    console.log(`    ${chalk.cyan('verdict dashboard generate')}`)
    process.exit(1)
  }

  const data = fs.readFileSync(inputPath, 'utf-8')

  // Find template
  const templatePath = findTemplatePath('index.html')
  if (!templatePath) {
    console.error(chalk.red('  ✗ Dashboard template not found'))
    process.exit(1)
  }

  let template = fs.readFileSync(templatePath, 'utf-8')
  const html = template.replace('/*__DASHBOARD_DATA__*/null', data)

  const port = parseInt(opts.port, 10)
  const { createServer } = await import('http')

  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  })

  server.listen(port, () => {
    console.log(chalk.green(`  ✓ Dashboard preview at: ${chalk.cyan(`http://localhost:${port}`)}`))
    console.log(chalk.dim('  Press Ctrl+C to stop'))
    console.log()
  })
}

// ─── Aggregation logic ───────────────────────────────────────────────────────

export function aggregateResults(resultsDir: string, files: string[]): DashboardData {
  const models: Record<string, DashboardModel> = {}
  const caseMap = new Map<string, DashboardCase>()
  const runIds = new Set<string>()

  for (const file of files) {
    let result: RunResult
    try {
      const content = fs.readFileSync(path.join(resultsDir, file), 'utf-8')
      result = JSON.parse(content)
    } catch {
      continue // skip invalid files
    }

    const runId = result.run_id || file.replace('.json', '')
    runIds.add(runId)

    // Collect model info
    for (const modelId of result.models || []) {
      if (!models[modelId]) {
        models[modelId] = { name: modelId }
      }
    }

    // Derive suite from eval pack filename or result name
    const suite = deriveSuite(result)

    // Process cases
    for (const c of result.cases || []) {
      const caseId = c.case_id
      if (!caseMap.has(caseId)) {
        caseMap.set(caseId, {
          id: caseId,
          name: caseId.replace(/[-_]/g, ' '),
          suite,
          prompt: c.prompt || '',
          runs: [],
        })
      }

      const dashCase = caseMap.get(caseId)!

      // Build run entry
      const responses: Record<string, DashboardResponse> = {}
      const scores: Record<string, DashboardScore> = {}

      for (const [modelId, resp] of Object.entries(c.responses || {})) {
        responses[modelId] = {
          text: resp.text || '',
          latency_ms: resp.latency_ms || 0,
        }
      }

      for (const [modelId, score] of Object.entries(c.scores || {})) {
        const dashScore: DashboardScore = {
          total: score.total || 0,
          reasoning: score.reasoning || '',
        }

        // Include per-dimension scores if available
        if (typeof score.accuracy === 'number' && typeof score.completeness === 'number' && typeof score.conciseness === 'number') {
          dashScore.dimensions = {
            accuracy: score.accuracy,
            completeness: score.completeness,
            conciseness: score.conciseness,
          }
        }

        // Include structured reasoning if available
        if (score.structured_reasoning) {
          dashScore.structured_reasoning = score.structured_reasoning as DashboardScore['structured_reasoning']
        }

        scores[modelId] = dashScore
      }

      // Build run metadata from result-level metadata
      const runMeta: DashboardRunMeta = { run_id: runId }
      if (result.reproducibility?.config_file) runMeta.config_file = result.reproducibility.config_file
      if (result.environment?.verdict_version) runMeta.verdict_version = result.environment.verdict_version
      if (result.hardware) runMeta.hardware = `${result.hardware.cpu} ${result.hardware.ram_gb}GB`

      dashCase.runs.push({
        run_id: runId,
        run_meta: runMeta,
        responses,
        scores,
      })
    }
  }

  const cases = Array.from(caseMap.values())

  return {
    meta: {
      total_runs: runIds.size,
      total_cases: cases.length,
      total_models: Object.keys(models).length,
      last_updated: new Date().toISOString().split('T')[0],
    },
    models,
    cases,
  }
}

function deriveSuite(result: RunResult): string {
  // Try to get suite from eval_pack file name
  if (result.eval_pack?.file) {
    const base = path.basename(result.eval_pack.file, '.yaml')
    return base.replace(/[-_]/g, ' ')
  }
  // Fall back to result name
  if (result.name) {
    return result.name
  }
  return 'general'
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateDashboardData(data: unknown): string[] {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    errors.push('Data must be a JSON object')
    return errors
  }

  const d = data as Record<string, unknown>

  // meta
  if (!d.meta || typeof d.meta !== 'object') {
    errors.push('Missing "meta" object')
  } else {
    const meta = d.meta as Record<string, unknown>
    if (typeof meta.total_runs !== 'number') errors.push('meta.total_runs must be a number')
    if (typeof meta.total_cases !== 'number') errors.push('meta.total_cases must be a number')
    if (typeof meta.last_updated !== 'string') errors.push('meta.last_updated must be a string')
  }

  // models
  if (!d.models || typeof d.models !== 'object') {
    errors.push('Missing "models" object')
  } else {
    const models = d.models as Record<string, unknown>
    for (const [id, m] of Object.entries(models)) {
      if (!m || typeof m !== 'object') {
        errors.push(`models.${id} must be an object`)
      } else {
        const model = m as Record<string, unknown>
        if (typeof model.name !== 'string') {
          errors.push(`models.${id}.name must be a string`)
        }
      }
    }
  }

  // cases
  if (!Array.isArray(d.cases)) {
    errors.push('Missing "cases" array')
  } else {
    for (let i = 0; i < d.cases.length; i++) {
      const c = d.cases[i] as Record<string, unknown>
      if (!c || typeof c !== 'object') {
        errors.push(`cases[${i}] must be an object`)
        continue
      }
      if (typeof c.id !== 'string') errors.push(`cases[${i}].id must be a string`)
      if (!Array.isArray(c.runs)) {
        errors.push(`cases[${i}].runs must be an array`)
      } else {
        for (let j = 0; j < c.runs.length; j++) {
          const run = c.runs[j] as Record<string, unknown>
          if (!run || typeof run !== 'object') {
            errors.push(`cases[${i}].runs[${j}] must be an object`)
            continue
          }
          if (typeof run.run_id !== 'string') errors.push(`cases[${i}].runs[${j}].run_id must be a string`)
          if (!run.responses || typeof run.responses !== 'object') errors.push(`cases[${i}].runs[${j}].responses must be an object`)
          if (!run.scores || typeof run.scores !== 'object') errors.push(`cases[${i}].runs[${j}].scores must be an object`)
        }
      }
    }
  }

  return errors
}

// ─── Serve command ──────────────────────────────────────────────────────────

export async function dashboardServeCommand(opts: ServeOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' dashboard serve'))
  console.log()

  const resultsDir = path.resolve(opts.results)
  if (!fs.existsSync(resultsDir)) {
    console.error(chalk.red(`  ✗ Results directory not found: ${opts.results}`))
    console.log(chalk.dim('  Run some evals first:'))
    console.log(`    ${chalk.cyan('verdict run')}`)
    process.exit(1)
  }

  const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'))
  if (files.length === 0) {
    console.error(chalk.red('  ✗ No result JSON files found'))
    console.log(chalk.dim('  Run some evals first:'))
    console.log(`    ${chalk.cyan('verdict run')}`)
    process.exit(1)
  }

  // Find template
  const templatePath = findTemplatePath('index.html')
  if (!templatePath) {
    console.error(chalk.red('  ✗ Dashboard template not found'))
    process.exit(1)
  }

  const port = parseInt(opts.port, 10)
  const { createServer } = await import('http')

  const server = createServer((_req, res) => {
    // Re-aggregate on every request for live reloading
    const currentFiles = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'))
    const dashboardData = aggregateResults(resultsDir, currentFiles)
    const template = fs.readFileSync(templatePath, 'utf-8')
    const html = template.replace('/*__DASHBOARD_DATA__*/null', JSON.stringify(dashboardData))

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  })

  server.listen(port, () => {
    console.log(chalk.green(`  ✓ Dashboard serving at: ${chalk.cyan(`http://localhost:${port}`)}`))
    console.log(chalk.dim(`    Results dir: ${resultsDir}`))
    console.log(chalk.dim('    Auto-refreshes on each request'))
    console.log(chalk.dim('    Press Ctrl+C to stop'))
    console.log()
  })
}

// ─── Deploy command ─────────────────────────────────────────────────────────

export async function dashboardDeployCommand(opts: DeployOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' dashboard deploy'))
  console.log()

  const resultsDir = path.resolve(opts.results)
  if (!fs.existsSync(resultsDir)) {
    console.error(chalk.red(`  ✗ Results directory not found: ${opts.results}`))
    process.exit(1)
  }

  const spinner = ora('Generating dashboard...').start()

  const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'))
  if (files.length === 0) {
    spinner.fail('No result JSON files found')
    process.exit(1)
  }

  const dashboardData = aggregateResults(resultsDir, files)

  // Find template
  const templatePath = findTemplatePath('index.html')
  if (!templatePath) {
    spinner.fail('Dashboard template not found')
    process.exit(1)
  }

  const template = fs.readFileSync(templatePath, 'utf-8')
  const html = template.replace('/*__DASHBOARD_DATA__*/null', JSON.stringify(dashboardData))

  // Create output directory
  const outputDir = path.resolve(opts.output)
  fs.mkdirSync(outputDir, { recursive: true })
  const htmlPath = path.join(outputDir, 'index.html')
  fs.writeFileSync(htmlPath, html)
  fs.writeFileSync(path.join(outputDir, 'dashboard-data.json'), JSON.stringify(dashboardData, null, 2))

  spinner.succeed('Dashboard generated')

  const target = opts.to

  if (target === 'github-pages') {
    console.log()
    console.log(chalk.green(`  ✓ Dashboard files written to: ${chalk.cyan(outputDir)}`))
    console.log()
    console.log(chalk.dim('  To deploy to GitHub Pages:'))
    console.log(`    1. Commit the ${chalk.cyan(outputDir)} directory`)
    console.log(`    2. Go to Settings → Pages → Source → Deploy from branch`)
    console.log(`    3. Set folder to ${chalk.cyan('/' + path.relative(process.cwd(), outputDir))}`)
    console.log()
  } else if (target === 'cloudflare-pages') {
    console.log()
    console.log(chalk.green(`  ✓ Dashboard files written to: ${chalk.cyan(outputDir)}`))
    console.log()
    console.log(chalk.dim('  To deploy to Cloudflare Pages:'))
    console.log(`    ${chalk.cyan(`npx wrangler pages deploy ${outputDir}`)}`)
    console.log()
  } else {
    console.log()
    console.log(chalk.green(`  ✓ Dashboard files written to: ${chalk.cyan(outputDir)}`))
    console.log()
    console.log(chalk.dim(`  Deploy the ${outputDir} directory to your hosting provider.`))
    console.log()
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findTemplatePath(filename: string): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../dashboard/templates', filename),
    path.resolve(__dirname, '../../../../dashboard/templates', filename),
    path.resolve('dashboard/templates', filename),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}
