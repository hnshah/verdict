import { Command } from 'commander'
import chalk from 'chalk'
import { runCommand } from './commands/run.js'
import { modelsCommand, discoverCommand } from './commands/models.js'
import { initCommand } from './commands/init.js'
import { compareCommand } from './commands/compare.js'
import { baselineSaveCommand, baselineListCommand, baselineCompareCommand } from './commands/baseline.js'

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

program.parse()
