import fs from 'fs'
import path from 'path'
import readline from 'readline'
import chalk from 'chalk'
import type { RunResult } from '../../types/index.js'

interface PromoteOptions {
  run?: string
  nth?: number
  force?: boolean
  output?: string
}

function findResultFiles(outputDir: string): string[] {
  const dir = path.resolve(outputDir)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.startsWith('.') && !f.includes('baseline'))
    .sort()
    .reverse()
    .map(f => path.join(dir, f))
}

function parseRunId(filePath: string): string {
  return path.basename(filePath, '.json')
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes')
    })
  })
}

export async function promoteCommand(opts: PromoteOptions): Promise<void> {
  const outputDir = path.resolve('results')
  const baselinePath = opts.output ?? path.join(outputDir, 'baseline.json')

  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' promote'))
  console.log()

  const files = findResultFiles(outputDir)

  if (files.length === 0) {
    console.error(chalk.red('  No result files found in results/'))
    console.error(chalk.dim('  Run `verdict run` first to generate results.'))
    process.exit(1)
    return
  }

  let targetPath: string

  if (opts.run) {
    // Find by run ID
    const match = files.find(f => parseRunId(f) === opts.run || f.includes(opts.run!))
    if (!match) {
      console.error(chalk.red(`  Run "${opts.run}" not found.`))
      console.error(chalk.dim(`  Available runs:`))
      files.slice(0, 5).forEach(f => console.error(chalk.dim(`    ${parseRunId(f)}`)))
      process.exit(1)
      return
    }
    targetPath = match
  } else if (opts.nth !== undefined) {
    const idx = opts.nth - 1
    if (idx < 0 || idx >= files.length) {
      console.error(chalk.red(`  --nth ${opts.nth} is out of range (${files.length} runs available)`))
      process.exit(1)
      return
    }
    targetPath = files[idx]
  } else {
    // Default: most recent
    targetPath = files[0]
  }

  const runId = parseRunId(targetPath)

  // Parse the result for display
  let runResult: RunResult
  try {
    runResult = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as RunResult
  } catch {
    console.error(chalk.red(`  Could not parse ${targetPath}`))
    process.exit(1)
  }

  const topModel = runResult.models
    .map(id => runResult.summary[id])
    .filter(Boolean)
    .sort((a, b) => b.avg_total - a.avg_total)[0]

  console.log(chalk.dim('  Run:     ') + chalk.cyan(runId))
  console.log(chalk.dim('  Date:    ') + (runResult.timestamp?.slice(0, 19).replace('T', ' ') ?? 'unknown') + ' UTC')
  console.log(chalk.dim('  Cases:   ') + runResult.cases.length)
  console.log(chalk.dim('  Models:  ') + runResult.models.join(', '))
  if (topModel) {
    console.log(chalk.dim('  Top:     ') + chalk.green(`${topModel.model_id} (${topModel.avg_total.toFixed(2)}/10)`))
  }
  console.log()

  // Check if baseline already exists
  const baselineExists = fs.existsSync(baselinePath)
  if (baselineExists && !opts.force) {
    const existing = (() => {
      try {
        const prev = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as RunResult
        return prev.run_id ?? path.basename(baselinePath, '.json')
      } catch {
        return path.basename(baselinePath, '.json')
      }
    })()
    console.log(chalk.yellow(`  ⚠  Existing baseline: ${existing}`))
    const ok = await confirm(chalk.bold('  Overwrite? [y/N] '))
    if (!ok) {
      console.log(chalk.dim('  Cancelled.'))
      console.log()
      process.exit(0)
    }
    console.log()
  }

  fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
  fs.copyFileSync(targetPath, baselinePath)

  console.log(chalk.green(`  ✅ Promoted ${runId} → ${path.relative(process.cwd(), baselinePath)}`))
  console.log()
}
