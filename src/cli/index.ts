import { Command } from 'commander'
import chalk from 'chalk'
import readline from 'readline'
import { runCommand } from './commands/run.js'
import { modelsCommand, discoverCommand } from './commands/models.js'
import { initCommand } from './commands/init.js'
import { compareCommand } from './commands/compare.js'
import { baselineSaveCommand, baselineListCommand, baselineCompareCommand } from './commands/baseline.js'
import { historyCommand } from './commands/history.js'
import { routeCommand } from './commands/route.js'
import { reviewCommand } from './commands/review.js'
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
// Dashboard CLI removed - use custom build system in dashboard/build/ instead
// See WORKFLOW.md for complete dashboard workflow

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
  .action(discoverCommand)

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
  .command('review')
  .description('Review code with a coding model (pipe code via stdin: cat file.js | verdict review)')
  .option('-c, --config <path>', 'Config file', './verdict.yaml')
  .option('--model <id>', 'Model to use for review')
  .option('--max-tokens <n>', 'Max output tokens', parseInt)
  .option('--json', 'Output raw JSON instead of formatted review')
  .action(async (opts) => {
    // Read code from stdin
    const code = await new Promise<string>((resolve) => {
      const chunks: string[] = []
      const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
      rl.on('line', (line) => chunks.push(line))
      rl.on('close', () => resolve(chunks.join('\n')))
    })
    return reviewCommand(code, opts)
  })

program
  .command('serve')
  .description('Start OpenAI-compatible HTTP proxy with smart routing')
  .option('--port <n>', 'Port to listen on', '4000')
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
  .option('--result <path>', 'Path to result JSON file', { required: true })
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

// Dashboard CLI removed - use custom build system instead
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

program.parse()
