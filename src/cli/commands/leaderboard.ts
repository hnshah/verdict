import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'

interface LeaderboardOptions {
  output?: string
  format?: 'html' | 'markdown'
}

interface ModelStats {
  model: string
  totalRuns: number
  avgScore: number
  avgLatency: number
  lastRun: string
  cases: number
}

/**
 * Generate leaderboard from public results
 */
export async function leaderboardCommand(opts: LeaderboardOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' leaderboard'))
  console.log()

  const resultsPublic = path.resolve('results/public')
  
  if (!fs.existsSync(resultsPublic)) {
    console.error(chalk.red('  ✗ No public results directory found'))
    console.log()
    console.log(chalk.dim('  Run:'))
    console.log(`    ${chalk.cyan('verdict publish --result <result-file>')}`)
    console.log()
    process.exit(1)
  }

  const spinner = ora('Loading public results...').start()
  
  // Load all public results
  const files = fs.readdirSync(resultsPublic)
    .filter(f => f.endsWith('.json') && f !== '.gitkeep')

  if (files.length === 0) {
    spinner.fail('No public results found')
    console.log()
    console.log(chalk.dim('  Publish some results first:'))
    console.log(`    ${chalk.cyan('verdict publish --result results/private/<file>.json')}`)
    console.log()
    return
  }

  spinner.text = `Processing ${files.length} result(s)...`

  // Aggregate stats by model
  const modelStats = new Map<string, ModelStats>()

  for (const file of files) {
    try {
      const filePath = path.join(resultsPublic, file)
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      
      for (const modelId of data.models || []) {
        if (!modelStats.has(modelId)) {
          modelStats.set(modelId, {
            model: modelId,
            totalRuns: 0,
            avgScore: 0,
            avgLatency: 0,
            lastRun: '',
            cases: 0
          })
        }

        const stats = modelStats.get(modelId)!
        stats.totalRuns++
        stats.lastRun = data.timestamp

        // Calculate average score and latency from cases
        let totalScore = 0
        let totalLatency = 0
        let caseCount = 0

        for (const c of data.cases || []) {
          if (c.scores?.[modelId]) {
            totalScore += c.scores[modelId].total || 0
            caseCount++
          }
          if (c.responses?.[modelId]) {
            totalLatency += c.responses[modelId].latency_ms || 0
          }
        }

        if (caseCount > 0) {
          stats.avgScore = totalScore / caseCount
          stats.avgLatency = totalLatency / caseCount
          stats.cases += caseCount
        }
      }
    } catch (err) {
      spinner.warn(`Skipped invalid result: ${file}`)
    }
  }

  spinner.succeed(`Loaded ${files.length} result(s)`)
  
  // Sort by average score (descending)
  const sortedModels = Array.from(modelStats.values())
    .sort((a, b) => b.avgScore - a.avgScore)

  console.log()
  console.log(chalk.bold('  Leaderboard:'))
  console.log()

  // Print table header
  console.log(chalk.dim('  Rank  Model                Score    Latency   Runs   Cases'))
  console.log(chalk.dim('  ────  ────────────────────────────────────────────────────'))

  // Print rows
  sortedModels.forEach((stats, idx) => {
    const rank = (idx + 1).toString().padStart(4)
    const model = stats.model.padEnd(18)
    const score = stats.avgScore.toFixed(1).padStart(5)
    const latency = `${Math.round(stats.avgLatency)}ms`.padStart(8)
    const runs = stats.totalRuns.toString().padStart(5)
    const cases = stats.cases.toString().padStart(6)

    let color = chalk.white
    if (idx === 0) color = chalk.green
    else if (idx === 1) color = chalk.cyan
    else if (idx === 2) color = chalk.yellow

    console.log(`  ${rank}  ${color(model)}  ${score}    ${latency}  ${runs}   ${cases}`)
  })

  console.log()

  // Generate HTML if requested
  const format = opts.format || 'html'
  const output = opts.output || (format === 'html' ? 'docs/index.html' : 'leaderboard.md')

  if (format === 'html') {
    const spinner2 = ora('Generating HTML...').start()
    try {
      const html = generateHTML(sortedModels, files.length)
      
      // Ensure docs directory exists
      const docsDir = path.dirname(output)
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true })
      }

      fs.writeFileSync(output, html)
      spinner2.succeed(`Generated: ${chalk.cyan(output)}`)
      
      console.log()
      console.log(chalk.green('  ✓ Next steps:'))
      console.log(`    1. Commit: ${chalk.cyan('git add docs/ results/public/ && git commit -m "Update leaderboard"')}`)
      console.log(`    2. Push: ${chalk.cyan('git push')}`)
      console.log(`    3. View at: ${chalk.cyan('https://hnshah.github.io/verdict')}`)
      console.log()
    } catch (err) {
      spinner2.fail(`Failed to generate HTML: ${err}`)
      process.exit(1)
    }
  }
}

/**
 * Generate simple HTML leaderboard
 */
function generateHTML(models: ModelStats[], totalResults: number): string {
  const now = new Date().toISOString().split('T')[0]
  
  const rows = models.map((stats, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
    return `
      <tr>
        <td>${medal}</td>
        <td><strong>${stats.model}</strong></td>
        <td>${stats.avgScore.toFixed(1)}</td>
        <td>${Math.round(stats.avgLatency)}ms</td>
        <td>${stats.totalRuns}</td>
        <td>${stats.cases}</td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verdict Leaderboard - Local LLM Benchmarks</title>
  <meta name="description" content="Real local LLM benchmarks on Apple Silicon">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
    }
    header {
      text-align: center;
      margin-bottom: 3rem;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      color: #2c3e50;
    }
    .subtitle {
      color: #7f8c8d;
      font-size: 1.1rem;
    }
    .meta {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin: 2rem 0;
      color: #7f8c8d;
      font-size: 0.9rem;
    }
    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
      margin-bottom: 2rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 1rem;
      text-align: left;
    }
    th {
      background: #34495e;
      color: white;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 0.5px;
    }
    tr:nth-child(even) {
      background: #f8f9fa;
    }
    tr:hover {
      background: #e8f4f8;
    }
    td:first-child {
      font-size: 1.2rem;
    }
    .footer {
      text-align: center;
      margin-top: 3rem;
      color: #7f8c8d;
      font-size: 0.9rem;
    }
    .footer a {
      color: #3498db;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    @media (max-width: 768px) {
      body { padding: 1rem; }
      h1 { font-size: 1.8rem; }
      .meta { flex-direction: column; gap: 0.5rem; }
      th, td { padding: 0.75rem 0.5rem; font-size: 0.9rem; }
    }
  </style>
</head>
<body>
  <header>
    <h1>🏆 Verdict Leaderboard</h1>
    <p class="subtitle">Local LLM Benchmarks</p>
    <div class="meta">
      <span>📅 Updated: ${now}</span>
      <span>📊 ${totalResults} benchmark runs</span>
      <span>🤖 ${models.length} models</span>
    </div>
  </header>

  <main>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Model</th>
            <th>Score</th>
            <th>Latency</th>
            <th>Runs</th>
            <th>Cases</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </div>
  </main>

  <footer class="footer">
    <p>Powered by <a href="https://github.com/hnshah/verdict" target="_blank">Verdict</a></p>
    <p>Data: <a href="../results/public/" target="_blank">JSON Results</a></p>
  </footer>
</body>
</html>`
}
