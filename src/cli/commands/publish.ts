import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import { execSync } from 'child_process'

interface PublishOptions {
  result?: string
  dryRun?: boolean
}

/**
 * Publish command: Move result from private to public and generate leaderboard
 */
export async function publishCommand(opts: PublishOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' publish'))
  console.log()

  const resultsPrivate = path.resolve('results/private')
  const resultsPublic = path.resolve('results/public')

  // Ensure directories exist
  if (!fs.existsSync(resultsPrivate)) {
    fs.mkdirSync(resultsPrivate, { recursive: true })
  }
  if (!fs.existsSync(resultsPublic)) {
    fs.mkdirSync(resultsPublic, { recursive: true })
  }

  // If specific result provided
  if (opts.result) {
    const resultPath = path.resolve(opts.result)
    
    if (!fs.existsSync(resultPath)) {
      console.error(chalk.red(`  ✗ Result file not found: ${opts.result}`))
      process.exit(1)
    }

    // Read and validate JSON
    let resultData
    try {
      const content = fs.readFileSync(resultPath, 'utf-8')
      resultData = JSON.parse(content)
    } catch (err) {
      console.error(chalk.red(`  ✗ Failed to parse result JSON: ${err}`))
      process.exit(1)
    }

    // Check if it's already public
    const filename = path.basename(resultPath)
    const publicPath = path.join(resultsPublic, filename)

    if (fs.existsSync(publicPath)) {
      console.log(chalk.yellow(`  ⚠ Result already published: ${filename}`))
      console.log()
      return
    }

    if (opts.dryRun) {
      console.log(chalk.yellow('  [dry run] Would publish:'))
      console.log(`    ${chalk.cyan(filename)}`)
      console.log(`    Run ID: ${resultData.run_id || 'unknown'}`)
      console.log(`    Models: ${(resultData.models || []).join(', ')}`)
      console.log()
      return
    }

    // Copy to public
    const spinner = ora('Publishing result...').start()
    try {
      fs.copyFileSync(resultPath, publicPath)
      spinner.succeed(`Published: ${chalk.cyan(filename)}`)
      
      console.log()
      console.log(chalk.green('  ✓ Next steps:'))
      console.log(`    1. Generate leaderboard: ${chalk.cyan('verdict leaderboard')}`)
      console.log(`    2. Commit and push: ${chalk.cyan('git add results/public/ && git commit && git push')}`)
      console.log(`    3. View at: ${chalk.cyan('https://hnshah.github.io/verdict')}`)
      console.log()
    } catch (err) {
      spinner.fail(`Failed to publish: ${err}`)
      process.exit(1)
    }
  } else {
    // List private results that can be published
    const privateFiles = fs.readdirSync(resultsPrivate)
      .filter(f => f.endsWith('.json') && f !== '.gitkeep')

    if (privateFiles.length === 0) {
      console.log(chalk.yellow('  No private results to publish'))
      console.log()
      console.log(chalk.dim('  Run some evals first:'))
      console.log(`    ${chalk.cyan('verdict run verdict.yaml')}`)
      console.log()
      return
    }

    console.log(chalk.bold('  Available results to publish:'))
    console.log()

    for (const file of privateFiles) {
      const filePath = path.join(resultsPrivate, file)
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const runId = data.run_id || 'unknown'
        const models = (data.models || []).join(', ')
        
        console.log(`    ${chalk.cyan(file)}`)
        console.log(`      Run ID: ${runId}`)
        console.log(`      Models: ${models}`)
        console.log()
      } catch (err) {
        console.log(`    ${chalk.dim(file)} ${chalk.red('(invalid JSON)')}`)
      }
    }

    console.log(chalk.dim('  To publish a result:'))
    console.log(`    ${chalk.cyan('verdict publish --result results/private/<filename>.json')}`)
    console.log()
  }
}
