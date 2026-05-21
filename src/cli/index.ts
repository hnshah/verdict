import { Command } from 'commander'
import chalk from 'chalk'
import { runCommand } from './commands/run.js'
import { modelsCommand, discoverCommand, catalogCommand, suggestCommand, autoPullCommand } from './commands/models.js'
import { initCommand } from './commands/init.js'
import { compareCommand } from './commands/compare.js'
import { baselineSaveCommand, baselineListCommand, baselineCompareCommand } from './commands/baseline.js'
import { historyCommand } from './commands/history.js'
import { routeCommand } from './commands/route.js'
import { serveCommand } from './commands/serve.js'
import { daemonStartCommand, daemonStopCommand, daemonStatusCommand, daemonLogsCommand, daemonWorkerCommand } from './commands/daemon.js'
import { watchCommand } from './commands/watch.js'
import { validateCommand } from './commands/validate.js'
import { publishCommand } from './commands/publish.js'
import { leaderboardCommand } from './commands/leaderboard.js'
import { reportCommand } from './commands/report.js'
import { evalAddCommand, evalRemoveCommand, evalListCommand, evalInitCommand } from './commands/eval.js'
import { contributeCommand } from './commands/contribute.js'
import { tuiCommand } from './commands/tui.js'
import { dashboardBuildCommand } from './commands/dashboard.js'
import { telemetryOnCommand, telemetryOffCommand, telemetryStatusCommand } from './commands/telemetry.js'
import { setupCommand } from './commands/setup.js'
import { prCommentCommand } from './commands/pr-comment.js'
import { badgeCommand } from './commands/badge.js'
import { quantsCommand } from './commands/quants.js'
import { onboardingCommand } from '../onboarding/cli.js'
import { readMark } from '../onboarding/persistence.js'
import fs from 'fs'

process.stdout.on('error', err => {
  if ((err as NodeJS.ErrnoException).code === 'EPIPE') process.exit(0)
  throw err
})

const program = new Command()

program
  .name('verdict')
  .description(chalk.bold('verdict') + '\nLLM eval framework. Benchmark local and cloud models with one config file.')
  .version('0.3.0')

program
  .command('tui')
  .description('Open the interactive terminal UI (browse runs, launch evals, monitor daemon)')
  .action(tuiCommand)

program
  .command('init')
  .description('Create verdict.yaml and starter eval packs')
  .option('--yes', 'Overwrite existing config')
  .option('--telemetry <state>', 'Set telemetry on/off non-interactively (default: prompt)')
  .action(initCommand)

program
  .command('run')
  .description('Run evals')
  .option('-c, --config <path>', 'Config file', './verdict.yaml')
  .option('-p, --pack <names>', 'Run specific pack(s), comma-separated')
  .option('-e, --eval <names>', 'Run named eval(s) from registry, comma-separated')
  .option('-m, --models <ids>', 'Run specific model(s), comma-separated')
  .option('--dry-run', 'Preview without calling any APIs')
  .option('--resume', 'Resume from last checkpoint')
  .option('--question <text>', 'Question for synthesis agent to answer after eval')
  .option('--no-store', 'Skip persisting results to SQLite database')
  .option('--category <categories...>', 'Filter cases by category (repeatable)')
  .option('--json', 'Output results as JSON to stdout (for CI/CD pipelines)')
  .option('--fail-if-regression', 'Exit with code 1 if any model regresses vs the default baseline')
  .option('--verbose', 'Show model call results, scores, and timing as they happen')
  .option('--debug', 'Show verbose output plus raw API request/response bodies')
  .action(runCommand)

const models = program
  .command('models')
  .description('List and ping configured models')
  .option('-c, --config <path>', 'Config file', './verdict.yaml')
  .action(modelsCommand)

models
  .command('discover')
  .description('Scan for local inference servers (Ollama, MLX, LM Studio)')
  .option('--json', 'Output discovered models as JSON')
  .action(discoverCommand)

models
  .command('catalog')
  .description('List curated catalog models with current hardware fit verdicts')
  .option('--catalog <path>', 'Model catalog YAML file', './configs/model-catalog.yaml')
  .option('--json', 'Output catalog and fit verdicts as JSON')
  .action(catalogCommand)

models
  .command('suggest')
  .description('Suggest catalog models that fit this machine and are missing from verdict.yaml')
  .option('-c, --config <path>', 'Config file', './verdict.yaml')
  .option('--catalog <path>', 'Model catalog YAML file', './configs/model-catalog.yaml')
  .option('--json', 'Output suggestions as JSON')
  .action(suggestCommand)

models
  .command('auto-pull')
  .description('Pull fitting small Ollama catalog models that are not installed')
  .option('--max-size <billions>', 'Largest model size to auto-pull, in billions of parameters', '8')
  .option('--dry-run', 'Show models that would be pulled without pulling')
  .option('--catalog <path>', 'Model catalog YAML file', './configs/model-catalog.yaml')
  .option('--json', 'Output pull summary as JSON')
  .action(autoPullCommand)

program
  .command('compare [run-a] [run-b]')
  .description('Compare two result JSON files — show score deltas and rank changes')
  .option('-o, --output <path>', 'Save comparison as markdown file')
  .option('--baseline <path>', 'Baseline result file (alternative to run-a)')
  .option('--current <path>', 'Current result file (alternative to run-b)')
  .option('--threshold <number>', 'Regression threshold (default: 0.5)', parseFloat)
  .option('--format <type>', 'Output format: terminal or json', /^(terminal|json)$/)
  .action((runA, runB, opts) => {
    // Support both positional and named arguments
    if (!runA && !opts.baseline) {
      console.error('Error: Provide either <run-a> <run-b> or --baseline --current')
      process.exit(1)
    }
    return compareCommand(runA || '', runB || '', opts)
  })

const baseline = program
  .command('baseline')
  .description('Manage saved baselines for regression detection')

baseline
  .command('save <name>')
  .description('Save the most recent result as a named baseline')
  .option('-c, --config <path>', 'Config file', './verdict.yaml')
  .action(baselineSaveCommand)

baseline
  .command('list')
  .description('Show saved baselines with date and model count')
  .action(baselineListCommand)

baseline
  .command('compare <name>')
  .description('Compare most recent run against a named baseline')
  .option('-c, --config <path>', 'Config file', './verdict.yaml')
  .action(baselineCompareCommand)

program
  .command('history')
  .description('View eval history from local database')
  .option('--model <id>', 'Filter by model ID')
  .option('--pack <name>', 'Filter by eval pack')
  .option('--since <time>', 'Filter by time (e.g., 7d, 24h, 30d, 1w)')
  .option('--limit <n>', 'Number of rows to show', '20')
  .option('--sort <field>', 'Sort by: date (default), score')
  .option('--trend', 'Show sparkline score trends per model')
  .action(historyCommand)

program
  .command('route <prompt>')
  .description('Route a prompt to the best model based on eval history')
  .option('--type <type>', 'Task type hint (reasoning, coding, summarize, fast)')
  .option('--prefer <pref>', 'Prefer model type (local)')
  .option('--min-score <n>', 'Minimum acceptable score')
  .option('--dry-run', 'Show selected model without running inference')
  .option('--model <id>', 'Force a specific model')
  .action(routeCommand)

program
  .command('serve')
  .description('Start OpenAI-compatible HTTP proxy with smart routing')
  .option('--port <n>', 'Port to listen on', '4000')
  .option('--ui', 'Also serve a local read-only dashboard at / (no auth, localhost only)')
  .action(serveCommand)

const daemon = program
  .command('daemon')
  .description('Background job daemon for running evals, summarization, research, and batch jobs')

daemon
  .command('start')
  .description('Start the daemon in the background')
  .action(daemonStartCommand)

daemon
  .command('stop')
  .description('Stop the running daemon')
  .action(daemonStopCommand)

daemon
  .command('status')
  .description('Show daemon status (queue depth, current job, uptime)')
  .action(daemonStatusCommand)

daemon
  .command('logs')
  .description('Tail daemon log file')
  .option('--tail <n>', 'Number of lines to show', '50')
  .action(daemonLogsCommand)

daemon
  .command('worker')
  .description(false as unknown as string) // hidden internal command
  .action(daemonWorkerCommand)

program
  .command('watch')
  .description('Poll local backends for new models')
  .option('--continuous', 'Poll continuously (foreground)')
  .option('--interval <seconds>', 'Poll interval in seconds', '60')
  .option('--no-auto-eval', 'Detect but do not auto-queue evals')
  .action(watchCommand)

program
  .command('validate [config]')
  .description('Check a verdict.yaml config for errors without running evals')
  .action((config: string | undefined, _opts: unknown) => {
    return validateCommand({ config: config ?? './verdict.yaml' })
  })

program
  .command('publish')
  .description('Publish private results to public leaderboard')
  .option('--result <path>', 'Specific result JSON file to publish')
  .option('--dry-run', 'Preview what would be published')
  .action(publishCommand)

program
  .command('leaderboard')
  .description('Generate HTML leaderboard from public results')
  .option('-o, --output <path>', 'Output file path', 'docs/index.html')
  .option('--format <type>', 'Output format (html, markdown)', 'html')
  .action(leaderboardCommand)

program
  .command('report')
  .description('Generate detailed HTML report from a result file')
  .requiredOption('--result <path>', 'Path to result JSON file')
  .option('--output <path>', 'Output HTML file path (default: docs/runs/<run_id>.html)')
  .action((opts: any) => reportCommand({ result: opts.result, output: opts.output }))
const evalCmd = program
  .command('eval')
  .description('Manage the named eval registry')

evalCmd
  .command('add <name> <path>')
  .description('Register an eval pack under a name')
  .action(evalAddCommand)

evalCmd
  .command('remove <name>')
  .description('Remove an eval from the registry')
  .action(evalRemoveCommand)

evalCmd
  .command('list')
  .description('Show all registered evals')
  .action(evalListCommand)

evalCmd
  .command('init')
  .description('Auto-register built-in eval packs')
  .action(evalInitCommand)

const dashboardCmd = program
  .command('dashboard')
  .description('Build the static dashboard from local run results')

dashboardCmd
  .command('build')
  .description('Regenerate dashboard-data.json and rebuild all HTML pages')
  .option('--skip-regenerate', 'Use existing dashboard-data.json, only rebuild HTML')
  .action((opts) => dashboardBuildCommand({ skipRegenerate: opts.skipRegenerate }))

const telemetryCmd = program
  .command('telemetry')
  .description('Manage opt-in anonymous telemetry (off by default)')

telemetryCmd
  .command('on')
  .description('Opt in to anonymous telemetry')
  .action(telemetryOnCommand)

telemetryCmd
  .command('off')
  .description('Opt out of anonymous telemetry')
  .action(telemetryOffCommand)

telemetryCmd
  .command('status')
  .description('Show current telemetry state')
  .action(telemetryStatusCommand)

program
  .command('setup')
  .description('One-command setup helper (use --autonomous for 24/7 cron)')
  .option('--autonomous', 'Install Hermes cron job + verify dashboard build path')
  .option('--dry-run', 'Show what would run without invoking hermes')
  .action(setupCommand)

program
  .command('pr-comment <result>')
  .description('Emit GitHub PR comment markdown from a result JSON (pipe to `gh pr comment`)')
  .action(prCommentCommand)

program
  .command('badge <result>')
  .description('Emit an SVG score badge for a result JSON (README/dashboards)')
  .option('--label <text>', 'Left-side label', 'verdict')
  .option('--show-model', 'Include winning model name in the badge text')
  .option('-o, --output <path>', 'Write SVG to this path instead of stdout')
  .action((result, opts) => badgeCommand(result, opts))

program
  .command('quants <base>')
  .description('Compare all installed Ollama quants of a base model (e.g. qwen2.5:7b)')
  .option('-c, --config <path>', 'Config file (for judge settings)', './verdict.yaml')
  .option('--pack <path>', 'Eval pack to run (default: ./eval-packs/quantization.yaml)')
  .option('--host <host>', 'Ollama host:port', 'localhost:11434')
  .action((base, opts) => quantsCommand(base, opts))

// 
// The built-in `verdict dashboard` command has been removed in favor of the
// custom multi-page dashboard system in dashboard/build/
//
// To update the dashboard:
//   1. Run evals: npx verdict run --eval-pack eval-packs/my-test.yaml
//   2. Add to dashboard: ./quick-add-run.sh results/LATEST.json
//
// See WORKFLOW.md for complete documentation

program
  .command('contribute')
  .description('Upload a result JSON to the shared dashboard repo (no git required)')
  .requiredOption('-r, --result <file>', 'Path to result JSON file')
  .option('--repo <owner/repo>', 'Target GitHub repo', 'hnshah/verdict')
  .option('--token <token>', 'GitHub PAT with Contents write permission (or set GITHUB_TOKEN)')
  .option('--author <name>', 'Bot name shown in commit message')
  .option('--dry-run', 'Show what would be uploaded without doing it')
  .action(contributeCommand)

program
  .command('onboarding')
  .description('First-run setup: detect environment, install Ollama, pull models, write verdict.yaml')
  .option('--headless', 'Skip the TUI; print periodic status to stdout')
  .option('--json', 'Emit NDJSON events to stdout (machine-readable)')
  .option('--force', 'Ignore prior completed/skipped mark and restart')
  .option('--resume', 'Resume from saved progress if a stale in-progress mark exists')
  .option('--detect-only', 'Run detection, print the resulting plan, then exit')
  .option('--skip', "Record 'skipped' status and exit immediately")
  .option('-c, --config <path>', 'verdict.yaml path', './verdict.yaml')
  .option('--catalog <path>', 'Model catalog path', './configs/model-catalog.yaml')
  .action(async opts => {
    const code = await onboardingCommand({
      headless: opts.headless,
      json: opts.json,
      force: opts.force,
      resume: opts.resume,
      detectOnly: opts.detectOnly,
      skip: opts.skip,
      configPath: opts.config,
      catalogPath: opts.catalog,
    })
    process.exit(code)
  })

// First-run dispatch: `verdict` with no args, on a TTY, with no verdict.yaml
// and no prior mark → launch onboarding instead of help. CI / non-TTY / no-args
// fall through to Commander's default help.
async function maybeFirstRunDispatch(): Promise<boolean> {
  if (process.argv.length > 2) return false
  if (!process.stdout.isTTY) return false
  if (process.env['CI']) return false
  if (process.env['VERDICT_SKIP_ONBOARDING'] === '1') return false
  if (fs.existsSync('./verdict.yaml')) return false
  const mark = readMark()
  if (mark && (mark.status === 'completed' || mark.status === 'skipped')) return false
  // Launch onboarding.
  const code = await onboardingCommand({})
  process.exit(code)
}

void maybeFirstRunDispatch().then(handled => {
  if (!handled) program.parse()
})
