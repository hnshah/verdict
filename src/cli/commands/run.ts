import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import { loadConfig, loadEvalPack } from '../../core/config.js'
import { runEvals } from '../../core/runner.js'
import { synthesizeRun } from '../../core/synthesis.js'
import { loadBaseline, compareWithBaseline } from '../../core/baseline.js'
import { printSummary, printCaseDetail, printBaselineComparison, printSynthesis } from '../../reporter/terminal.js'
import { generateMarkdownReport } from '../../reporter/markdown.js'
import type { SlackCard } from '../../types/index.js'

interface RunOptions {
  config: string
  pack?: string
  models?: string
  dryRun?: boolean
  resume?: boolean
  question?: string
}

export async function runCommand(opts: RunOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' run'))
  console.log()

  let config
  try {
    config = loadConfig(opts.config)
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  if (opts.models) {
    const ids = opts.models.split(',').map(s => s.trim())
    config.models = config.models.filter(m => ids.includes(m.id))
    if (!config.models.length) {
      console.error(chalk.red(`  No models matched: ${opts.models}`))
      process.exit(1)
    }
  }

  const configDir = path.dirname(path.resolve(opts.config))
  const packPaths = opts.pack ? opts.pack.split(',').map(p => p.trim()) : config.packs
  const packs = []
  for (const p of packPaths) {
    try { packs.push(loadEvalPack(p, configDir)) }
    catch (err) { console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`)); process.exit(1) }
  }

  const totalCases = packs.reduce((n, p) => n + p.cases.length, 0)
  console.log(`  ${chalk.bold('Models:')} ${config.models.map(m => chalk.cyan(m.id)).join(', ')}`)
  console.log(`  ${chalk.bold('Judge: ')} ${chalk.cyan(config.judge.model)}`)
  console.log(`  ${chalk.bold('Cases:')} ${totalCases} across ${packs.length} pack(s)`)
  if (opts.resume) console.log(`  ${chalk.bold('Resume:')} ${chalk.yellow('enabled')}`)
  if (opts.question) console.log(`  ${chalk.bold('Question:')} ${chalk.yellow(opts.question)}`)
  console.log()

  if (opts.dryRun) {
    console.log(chalk.yellow('  dry run: no API calls made'))
    for (const pack of packs) {
      console.log(`\n  ${chalk.bold(pack.name)}`)
      for (const c of pack.cases) {
        console.log(`    ${chalk.dim(c.id.padEnd(22))} ${c.prompt.slice(0, 60)}`)
      }
    }
    console.log()
    return
  }

  const spinner = ora({ prefixText: '  ', text: 'Starting...' }).start()
  let result
  try {
    result = await runEvals(config, packs, msg => { spinner.text = msg }, opts.resume)
    spinner.succeed('Done')
  } catch (err) {
    spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)))
    process.exit(1)
  }

  for (const c of result.cases) printCaseDetail(c.case_id, c.prompt, c.scores)
  printSummary(result)

  // Auto-compare with default baseline if it exists
  const defaultBaseline = loadBaseline('default')
  if (defaultBaseline) {
    const comparison = compareWithBaseline(defaultBaseline, result, 'default')
    result.baselineComparison = comparison
    printBaselineComparison(comparison)
  }

  // Synthesis agent
  if (opts.question) {
    const judgeModel = config.models.find(m => m.id === config.judge.model)
    if (judgeModel) {
      const synthSpinner = ora({ prefixText: '  ', text: 'Synthesizing...' }).start()
      try {
        const synthesis = await synthesizeRun(
          judgeModel, config.judge, opts.question, result, result.baselineComparison
        )
        result.synthesis = synthesis
        synthSpinner.succeed('Synthesis complete')
        printSynthesis(synthesis)
      } catch (err) {
        synthSpinner.fail(chalk.red(`Synthesis failed: ${err instanceof Error ? err.message : String(err)}`))
      }
    }
  }

  fs.mkdirSync(config.output.dir, { recursive: true })
  const ts = new Date().toISOString().slice(0, 10)
  const base = path.join(config.output.dir, `${ts}-${result.run_id}`)

  fs.writeFileSync(`${base}.json`, JSON.stringify(result, null, 2))
  if (config.output.formats.includes('markdown')) {
    fs.writeFileSync(`${base}.md`, generateMarkdownReport(result))
    console.log(chalk.dim(`  report: ${base}.md`))
  }
  if (config.output.formats.includes('slack')) {
    const sorted = result.models
      .map(id => result.summary[id])
      .filter(Boolean)
      .sort((a, b) => b.avg_total - a.avg_total)
    const winner = sorted[0]
    const slackCard: SlackCard = {
      winner: winner?.model_id ?? 'unknown',
      winnerScore: winner?.avg_total ?? 0,
      runId: result.run_id,
      synthesis: result.synthesis,
      regressionAlert: result.baselineComparison?.regressionAlert ?? false,
      markdownPath: `${base}.md`,
    }
    fs.writeFileSync(`${base}.slack-card.json`, JSON.stringify(slackCard, null, 2))
    console.log(chalk.dim(`  slack:  ${base}.slack-card.json`))
  }
  console.log(chalk.dim(`  raw:    ${base}.json`))
  console.log()
}
