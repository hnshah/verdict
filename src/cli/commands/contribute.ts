import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'

interface ContributeOptions {
  result: string
  repo?: string
  token?: string
  dryRun?: boolean
  author?: string
}

const DEFAULT_REPO = 'hnshah/verdict'
const PUBLISHED_PATH = 'dashboard/published'

/**
 * Contribute command: Upload a result JSON to the shared dashboard repo via GitHub API.
 * Bots don't need git installed — just a GitHub PAT with Contents write permission.
 *
 * Usage:
 *   verdict contribute --result ./results/2026-03-30.json --token ghp_xxx
 *   GITHUB_TOKEN=ghp_xxx verdict contribute --result ./results/2026-03-30.json
 */
export async function contributeCommand(opts: ContributeOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' contribute'))
  console.log()

  // Resolve result file
  const resultPath = path.resolve(opts.result)
  if (!fs.existsSync(resultPath)) {
    console.error(chalk.red(`  ✗ Result file not found: ${opts.result}`))
    console.log(chalk.dim('  Run some evals first:'))
    console.log(`    ${chalk.cyan('verdict run')}`)
    process.exit(1)
  }

  // Parse and validate
  let resultData: Record<string, unknown>
  try {
    const raw = fs.readFileSync(resultPath, 'utf-8')
    resultData = JSON.parse(raw)
  } catch (err) {
    console.error(chalk.red(`  ✗ Invalid JSON: ${err}`))
    process.exit(1)
  }

  const runId = (resultData.run_id as string) || path.basename(resultPath, '.json')
  const models = (resultData.models as string[]) || []

  console.log(`  Run ID: ${chalk.cyan(runId)}`)
  console.log(`  Models: ${chalk.cyan(models.join(', ') || '(none)')}`)
  console.log()

  // Resolve token and repo
  const token = opts.token || process.env.GITHUB_TOKEN || process.env.VERDICT_GITHUB_TOKEN
  const repo = opts.repo || process.env.VERDICT_REPO || DEFAULT_REPO

  if (!token) {
    console.error(chalk.red('  ✗ GitHub token required'))
    console.log()
    console.log(chalk.dim('  Set one of:'))
    console.log(`    ${chalk.cyan('--token ghp_xxx')}`)
    console.log(`    ${chalk.cyan('GITHUB_TOKEN=ghp_xxx')}`)
    console.log(`    ${chalk.cyan('VERDICT_GITHUB_TOKEN=ghp_xxx')}`)
    process.exit(1)
  }

  // Target file path in the repo
  const filename = path.basename(resultPath)
  const targetPath = `${PUBLISHED_PATH}/${filename}`
  const author = opts.author || 'Verdict Bot'

  if (opts.dryRun) {
    console.log(chalk.yellow('  [dry run] Would upload:'))
    console.log(`    ${chalk.cyan(targetPath)} → ${repo}`)
    console.log()
    return
  }

  const spinner = ora('Uploading result to dashboard...').start()

  try {
    const fileContent = fs.readFileSync(resultPath)
    const encoded = fileContent.toString('base64')

    // Check if file already exists (need SHA for updates)
    const apiBase = `https://api.github.com/repos/${repo}/contents/${targetPath}`
    let sha: string | undefined

    const checkResp = await fetch(apiBase, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (checkResp.ok) {
      const existing = (await checkResp.json()) as { sha: string }
      sha = existing.sha
    } else if (checkResp.status !== 404) {
      const err = (await checkResp.json()) as { message: string }
      throw new Error(`GitHub API error: ${err.message}`)
    }

    // Upload (create or update)
    const body: Record<string, unknown> = {
      message: `feat(dashboard): add eval run ${runId} from ${author}`,
      content: encoded,
      committer: {
        name: author,
        email: 'bot@verdict.dev',
      },
    }
    if (sha) body.sha = sha

    const uploadResp = await fetch(apiBase, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!uploadResp.ok) {
      const err = (await uploadResp.json()) as { message: string }
      throw new Error(`Upload failed: ${err.message}`)
    }

    spinner.succeed(`Contributed: ${chalk.cyan(filename)}`)

    console.log()
    console.log(chalk.green('  ✓ Result uploaded to dashboard'))
    console.log(`    Repo:   ${chalk.dim(repo)}`)
    console.log(`    Path:   ${chalk.dim(targetPath)}`)
    console.log()
    console.log(chalk.dim('  The dashboard will auto-regenerate shortly.'))
    console.log(`  View at: ${chalk.cyan(`https://hnshah.github.io/verdict`)}`)
    console.log()
  } catch (err) {
    spinner.fail(`Failed: ${err}`)
    process.exit(1)
  }
}
