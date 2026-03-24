import { Command } from 'commander'
import chalk from 'chalk'
import { runCommand } from './commands/run.js'
import { modelsCommand, discoverCommand } from './commands/models.js'
import { initCommand } from './commands/init.js'
import { compareCommand } from './commands/compare.js'

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

program.parse()
