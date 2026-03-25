import chalk from 'chalk'
import { loadConfig } from '../../core/config.js'
import { findLatestResult, saveBaseline, listBaselines, loadBaseline, compareWithBaseline } from '../../core/baseline.js'
import { printBaselineComparison } from '../../reporter/terminal.js'

interface SaveOptions {
  config: string
}

export async function baselineSaveCommand(name: string, opts: SaveOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' baseline save'))
  console.log()

  let config
  try {
    config = loadConfig(opts.config)
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  const latestPath = findLatestResult(config.output.dir)
  if (!latestPath) {
    console.error(chalk.red(`  No result files found in ${config.output.dir}`))
    process.exit(1)
  }

  const dest = saveBaseline(name, latestPath)
  console.log(chalk.green(`  Saved baseline "${name}"`))
  console.log(chalk.dim(`  ${dest}`))
  console.log()
}

export async function baselineListCommand(): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' baseline list'))
  console.log()

  const baselines = listBaselines()
  if (baselines.length === 0) {
    console.log(chalk.dim('  No baselines saved. Use `verdict baseline save <name>` to create one.'))
    console.log()
    return
  }

  const col = (s: string, w: number) => s.slice(0, w).padEnd(w)
  console.log(chalk.dim('  ' + col('Name', 20) + col('Date', 22) + col('Models', 8) + 'Cases'))
  console.log(chalk.dim('  ' + '-'.repeat(58)))

  for (const b of baselines) {
    console.log(`  ${col(b.name, 20)}${col(b.date, 22)}${col(String(b.modelCount), 8)}${b.caseCount}`)
  }
  console.log()
}

interface CompareOptions {
  config: string
}

export async function baselineCompareCommand(name: string, opts: CompareOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' baseline compare'))
  console.log()

  let config
  try {
    config = loadConfig(opts.config)
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  const baselineResult = loadBaseline(name)
  if (!baselineResult) {
    console.error(chalk.red(`  Baseline "${name}" not found. Use \`verdict baseline list\` to see available baselines.`))
    process.exit(1)
  }

  const latestPath = findLatestResult(config.output.dir)
  if (!latestPath) {
    console.error(chalk.red(`  No result files found in ${config.output.dir}`))
    process.exit(1)
  }

  let currentResult
  try {
    const fs = await import('fs')
    currentResult = JSON.parse(fs.readFileSync(latestPath, 'utf8'))
  } catch (err) {
    console.error(chalk.red(`  Could not read latest result: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  const comparison = compareWithBaseline(baselineResult, currentResult, name)
  printBaselineComparison(comparison)
}
