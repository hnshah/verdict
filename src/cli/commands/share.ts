import path from 'path'
import fs from 'fs'
import os from 'os'
import chalk from 'chalk'
import ora from 'ora'
import type { RunResult } from '../../types/index.js'
import { generateDetailedReport } from './report.js'

interface ShareOptions {
  run?: string
  output?: string
  gist?: boolean
  open?: boolean
}

function findResultFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.startsWith('.') && !f.includes('baseline'))
    .sort()
    .reverse()
    .map(f => path.join(dir, f))
}

function findLatestResult(): string | null {
  // Check local results/ dir first (private, then public)
  const dirs = [
    path.resolve('results/private'),
    path.resolve('results'),
  ]

  for (const dir of dirs) {
    const files = findResultFiles(dir)
    if (files.length > 0) return files[0]
  }

  return null
}

function findResultByRunId(runId: string): string | null {
  const dirs = [
    path.resolve('results/private'),
    path.resolve('results'),
  ]

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(dir, f))
    const match = files.find(f => path.basename(f, '.json') === runId || f.includes(runId))
    if (match) return match
  }

  return null
}

async function uploadToGist(html: string, runId: string, token: string): Promise<string | null> {
  const filename = `verdict-${runId}.html`
  const body = JSON.stringify({
    description: `verdict eval report — ${runId}`,
    public: false,
    files: {
      [filename]: { content: html },
    },
  })

  const resp = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'verdict-cli',
    },
    body,
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`GitHub Gist API error ${resp.status}: ${text}`)
  }

  const data = await resp.json() as { html_url: string; id: string; files: Record<string, { raw_url: string }> }
  // Return the raw URL so the HTML renders directly
  const rawUrl = data.files[filename]?.raw_url
  return rawUrl ?? data.html_url
}

async function openInBrowser(filePath: string): Promise<void> {
  const { exec } = await import('child_process')
  const url = `file://${path.resolve(filePath)}`

  const browserCmd =
    process.env.BROWSER ||
    (process.platform === 'darwin' ? `open "${url}"` :
     process.platform === 'win32' ? `start "${url}"` :
     `xdg-open "${url}"`)

  exec(browserCmd, (err) => {
    if (err) {
      // Silently ignore — we already printed the path
    }
  })
}

/**
 * verdict share — generate a self-contained HTML report and optionally share via GitHub Gist
 */
export async function shareCommand(opts: ShareOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' share'))
  console.log()

  // 1. Find result file
  let resultPath: string | null

  if (opts.run) {
    resultPath = findResultByRunId(opts.run)
    if (!resultPath) {
      console.error(chalk.red(`  ✗ No result found for run: ${opts.run}`))
      process.exit(1)
    }
  } else {
    resultPath = findLatestResult()
    if (!resultPath) {
      console.error(chalk.red('  ✗ No result files found.'))
      console.error(chalk.dim('    Run `verdict run` first to generate results.'))
      process.exit(1)
    }
  }

  const spinner = ora('Loading result...').start()

  // 2. Parse result
  let result: RunResult
  try {
    const content = fs.readFileSync(resultPath, 'utf-8')
    result = JSON.parse(content)
  } catch (err) {
    spinner.fail(`Failed to parse result: ${err}`)
    process.exit(1)
  }

  spinner.text = 'Generating self-contained HTML report...'

  // 3. Generate HTML
  const html = generateDetailedReport(result)

  // 4. Determine output path
  let outputPath: string
  let isTempFile = false

  if (opts.output) {
    outputPath = path.resolve(opts.output)
  } else if (opts.gist) {
    // Write to temp file, upload, then optionally clean up
    outputPath = path.join(os.tmpdir(), `verdict-${result.run_id}.html`)
    isTempFile = true
  } else {
    // Default: write to ./verdict-share/ directory
    const shareDir = path.resolve('verdict-share')
    if (!fs.existsSync(shareDir)) fs.mkdirSync(shareDir, { recursive: true })
    outputPath = path.join(shareDir, `${result.run_id}.html`)
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  // Write HTML
  fs.writeFileSync(outputPath, html)
  spinner.succeed(`Generated: ${chalk.cyan(path.relative(process.cwd(), outputPath))}`)

  // 5. Upload to GitHub Gist if requested
  if (opts.gist) {
    const token = process.env.GITHUB_TOKEN
    if (!token) {
      console.error(chalk.red('\n  ✗ --gist requires GITHUB_TOKEN environment variable'))
      process.exit(1)
    }

    const gistSpinner = ora('Uploading to GitHub Gist...').start()
    try {
      const gistUrl = await uploadToGist(html, result.run_id, token)
      gistSpinner.succeed('Uploaded to GitHub Gist')
      console.log()
      console.log(chalk.green('  ✓ Shareable URL:'))
      console.log(`    ${chalk.cyan(gistUrl)}`)

      // Clean up temp file
      if (isTempFile && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath)
      }
    } catch (err) {
      gistSpinner.fail(`Gist upload failed: ${err}`)
      // Still print the local file path
      console.log(chalk.dim(`\n  Local file saved at: ${outputPath}`))
    }
  } else {
    // Local output
    const absPath = path.resolve(outputPath)
    const fileUrl = `file://${absPath}`

    console.log()
    console.log(chalk.green('  ✓ Report ready!'))
    console.log(`    Run: ${chalk.dim(result.run_id)}`)
    console.log(`    Models: ${chalk.dim(result.models.join(', '))}`)
    console.log(`    Cases: ${chalk.dim(result.cases.length)}`)
    console.log()
    console.log(`    Open: ${chalk.cyan(fileUrl)}`)
    console.log()
    console.log(chalk.dim('  Tip: Share via Gist with --gist (requires GITHUB_TOKEN)'))

    // Auto-open if --open flag or $BROWSER is set
    if (opts.open || process.env.BROWSER) {
      await openInBrowser(outputPath)
    }
  }
}
