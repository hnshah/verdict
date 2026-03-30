import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import { loadConfig, loadEvalPack } from '../../core/config.js'
import { registryResolve } from '../../core/registry.js'
import { runEvals } from '../../core/runner.js'
import { synthesizeRun } from '../../core/synthesis.js'
import { loadBaseline, compareWithBaseline } from '../../core/baseline.js'
import { printSummary, printCaseDetail, printBaselineComparison, printSynthesis } from '../../reporter/terminal.js'
import { generateMarkdownReport } from '../../reporter/markdown.js'
import type { SlackCard } from '../../types/index.js'
import { setLogLevel } from '../../utils/logger.js'

interface RunOptions {
  config: string
  pack?: string
  eval?: string
  models?: string
  dryRun?: boolean
  resume?: boolean
  question?: string
  noStore?: boolean
  category?: string[]
  json?: boolean
  failIfRegression?: boolean
  verbose?: boolean
  debug?: boolean
}

export async function runCommand(opts: RunOptions): Promise<void> {
  // Set verbosity level before anything else
  if (opts.debug) setLogLevel('debug')
  else if (opts.verbose) setLogLevel('verbose')

  // When --json is set, suppress all non-JSON stdout output.
  // Informational messages go to stderr; only the final JSON goes to stdout.
  const log = opts.json ? (...args: unknown[]) => { process.stderr.write(args.join(' ') + '\n') } : console.log.bind(console)

  log()
  log(chalk.bold('  verdict') + chalk.dim(' run'))
  log()

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

  // Resolve pack paths: --eval (registry lookup) takes precedence, then --pack, then config
  let packPaths: string[]
  if (opts.eval) {
    const names = opts.eval.split(',').map(n => n.trim())
    packPaths = []
    for (const name of names) {
      const resolved = registryResolve(name)
      if (!resolved) {
        console.error(chalk.red(`  eval '${name}' not found in registry or as a file path`))
        console.error(chalk.dim(`  run 'verdict eval list' to see registered evals`))
        process.exit(1)
      }
      packPaths.push(resolved)
    }
  } else if (opts.pack) {
    packPaths = opts.pack.split(',').map(p => p.trim())
  } else {
    packPaths = config.packs
  }

  const packs = []
  for (const p of packPaths) {
    try { packs.push(loadEvalPack(p, configDir)) }
    catch (err) { console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`)); process.exit(1) }
  }

  // Normalize category filter
  const categoryFilter = opts.category && opts.category.length > 0 ? opts.category : undefined

  const totalCases = packs.reduce((n, p) => n + p.cases.length, 0)
  log(`  ${chalk.bold('Models:')} ${config.models.map(m => chalk.cyan(m.id)).join(', ')}`)
  log(`  ${chalk.bold('Judge: ')} ${chalk.cyan(config.judge.model)}`)
  if (categoryFilter) {
    const filteredCount = packs.reduce((n, p) => n + p.cases.filter(c => c.category && categoryFilter.includes(c.category)).length, 0)
    log(`  ${chalk.bold('Cases:')} ${filteredCount} across ${packs.length} pack(s) ${chalk.dim(`(filtered: ${categoryFilter.join(', ')})`)}`)
  } else {
    log(`  ${chalk.bold('Cases:')} ${totalCases} across ${packs.length} pack(s)`)
  }
  if (opts.resume) log(`  ${chalk.bold('Resume:')} ${chalk.yellow('enabled')}`)
  if (opts.question) log(`  ${chalk.bold('Question:')} ${chalk.yellow(opts.question)}`)
  log()

  if (opts.dryRun) {
    log(chalk.yellow('  dry run: no API calls made'))
    for (const pack of packs) {
      log(`\n  ${chalk.bold(pack.name)}`)
      for (const c of pack.cases) {
        log(`    ${chalk.dim(c.id.padEnd(22))} ${c.prompt.slice(0, 60)}`)
      }
    }
    log()
    return
  }

  // MoE concurrency warning
  const moeModels = config.models.filter(m => m.tags?.includes('moe'))
  if (moeModels.length > 0 && config.run.concurrency > 1) {
    log(chalk.yellow(`  ⚠  MoE model(s) detected: ${moeModels.map(m => m.id).join(', ')}`))
    log(chalk.yellow(`     concurrency is ${config.run.concurrency} — MoE models are memory-intensive.`))
    log(chalk.yellow('     Set concurrency: 1 in your config to avoid memory pressure on Apple Silicon.'))
    log()
  }

  // --debug: enable request/response logging in providers
  if (opts.debug) {
    process.env['VERDICT_DEBUG'] = '1'
    log(chalk.dim('  [debug] VERDICT_DEBUG enabled — provider requests will be logged'))
    log()
  }

  // --verbose: print each case result as it completes
  const onProgress = opts.verbose || opts.debug
    ? (msg: string) => {
        // In verbose mode, print case completions directly instead of just updating the spinner
        if (msg.includes('✓') || msg.includes('✗') || msg.includes('case')) {
          spinner.clear()
          log(chalk.dim(`  ${msg}`))
        } else {
          spinner.text = msg
        }
      }
    : (msg: string) => { spinner.text = msg }

  const spinner = ora({ prefixText: '  ', text: 'Starting...', stream: opts.json ? process.stderr : process.stdout }).start()
  let result
  try {
    result = await runEvals(config, packs, onProgress, opts.resume, categoryFilter)
    spinner.succeed('Done')
  } catch (err) {
    spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)))
    process.exit(1)
  }

  if (!opts.json) {
    for (const c of result.cases) printCaseDetail(c.case_id, c.prompt, c.scores)
    printSummary(result)
  }

  // Auto-compare with default baseline if it exists
  const defaultBaseline = loadBaseline('default')
  if (defaultBaseline) {
    const comparison = compareWithBaseline(defaultBaseline, result, 'default')
    result.baselineComparison = comparison
    if (!opts.json) printBaselineComparison(comparison)
  }

  // --fail-if-regression: exit 1 if any model regressed vs baseline
  if (opts.failIfRegression && result.baselineComparison) {
    const regressions = result.baselineComparison.deltas.filter(d => d.regression)
    if (regressions.length > 0) {
      const msg = `  ⚠  Regression detected in ${regressions.length} model(s): ${regressions.map(r => `${r.model} (${r.delta > 0 ? '+' : ''}${r.delta.toFixed(2)})`).join(', ')}`
      if (opts.json) {
        process.stderr.write(msg + '\n')
      } else {
        log(chalk.red(msg))
      }
      process.exit(1)
    }
  } else if (opts.failIfRegression && !defaultBaseline) {
    const msg = `  ⚠  --fail-if-regression: no default baseline found. Run 'verdict baseline save default' first.`
    if (opts.json) {
      process.stderr.write(msg + '\n')
    } else {
      log(chalk.yellow(msg))
    }
  }

  // Synthesis agent
  if (opts.question) {
    const judgeModel = config.models.find(m => m.id === config.judge.model)
    if (judgeModel) {
      const synthSpinner = ora({ prefixText: '  ', text: 'Synthesizing...', stream: opts.json ? process.stderr : process.stdout }).start()
      try {
        const synthesis = await synthesizeRun(
          judgeModel, config.judge, opts.question, result, result.baselineComparison
        )
        result.synthesis = synthesis
        synthSpinner.succeed('Synthesis complete')
        if (!opts.json) printSynthesis(synthesis)
      } catch (err) {
        synthSpinner.fail(chalk.red(`Synthesis failed: ${err instanceof Error ? err.message : String(err)}`))
      }
    }
  }

  // Output JSON to stdout when --json is set
  if (opts.json) {
    const summaryArray = result.models
      .map(id => result.summary[id])
      .filter(Boolean)
      .sort((a, b) => b.avg_total - a.avg_total)
    const jsonOutput = {
      verdictVersion: '0.2.0',
      timestamp: result.timestamp,
      packs: packs.map(p => p.name),
      models: result.models,
      results: result.cases,
      summary: summaryArray,
      ...(result.synthesis ? { synthesis: result.synthesis } : {}),
      ...(result.baselineComparison ? { baselineComparison: result.baselineComparison } : {}),
    }
    process.stdout.write(JSON.stringify(jsonOutput, null, 2) + '\n')
  }

  fs.mkdirSync(config.output.dir, { recursive: true })
  const ts = new Date().toISOString().slice(0, 10)
  const base = path.join(config.output.dir, `${ts}-${result.run_id}`)

  fs.writeFileSync(`${base}.json`, JSON.stringify(result, null, 2))

  // Persist to SQLite unless --no-store
  if (!opts.noStore) {
    try {
      const { getDb, initSchema, saveRunResult } = await import('../../db/client.js')
      const db = getDb()
      initSchema(db)
      const packName = opts.pack ?? config.packs[0] ?? 'unknown'
      // Extract pack basename without path/extension
      const packLabel = packName.replace(/^.*\//, '').replace(/\.ya?ml$/, '')
      saveRunResult(db, result, packLabel)
      db.close()
      log(chalk.dim(`  stored: ~/.verdict/results.db`))
    } catch (err) {
      console.warn(chalk.yellow(`  warning: failed to store results in DB: ${err instanceof Error ? err.message : err}`))
    }
  }

  if (config.output.formats.includes('markdown')) {
    fs.writeFileSync(`${base}.md`, generateMarkdownReport(result))
    log(chalk.dim(`  report: ${base}.md`))
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
    log(chalk.dim(`  slack:  ${base}.slack-card.json`))
  }
  log(chalk.dim(`  raw:    ${base}.json`))
  log()
}
