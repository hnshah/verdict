import { Command } from 'commander'
import chalk from 'chalk'
import { runCommand } from './commands/run.js'
import { modelsCommand, discoverCommand } from './commands/models.js'
import { initCommand } from './commands/init.js'
import { compareCommand } from './commands/compare.js'
import { baselineSaveCommand, baselineListCommand, baselineCompareCommand } from './commands/baseline.js'
import { historyCommand } from './commands/history.js'
import { routeCommand } from './commands/route.js'
import { serveCommand } from './commands/serve.js'
import { daemonStartCommand, daemonStopCommand, daemonStatusCommand, daemonLogsCommand, daemonWorkerCommand } from './commands/daemon.js'
import { watchCommand } from './commands/watch.js'
import { validateCommand } from './commands/validate.js'

const program = new Command()

program
  .name('verdict')
  .description(chalk.bold('verdict') + '\nLLM eval framework. Benchmark local and cloud models with one config file.')
  .version('0.2.0')

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
  .option('-m, --models <ids>', 'Run specific model(s), comma-separated')
  .option('--dry-run', 'Preview without calling any APIs')
  .option('--resume', 'Resume from last checkpoint')
  .option('--question <text>', 'Question for synthesis agent to answer after eval')
  .option('--no-store', 'Skip persisting results to SQLite database')
  .option('--category <categories...>', 'Filter cases by category (repeatable)')
  .option('--json', 'Output results as JSON to stdout (for CI/CD pipelines)')
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
  .command('compare <run-a> <run-b>')
  .description('Compare two result JSON files — show score deltas and rank changes')
  .option('-o, --output <path>', 'Save comparison as markdown file')
  .action(compareCommand)

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

program.parse()
