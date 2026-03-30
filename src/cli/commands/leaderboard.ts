import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import os from 'os'
import { execSync } from 'child_process'
import type { RunResult } from '../../types/index.js'
import { getHuggingFaceLink, getOllamaLink, getModelDisplayName } from '../../utils/model-links.js'

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
  runs: RunDetail[]
}

interface RunDetail {
  runId: string
  timestamp: string
  packName: string
  avgScore: number
  avgLatency: number
  cases: number
  resultFile: string
}

interface HardwareInfo {
  cpu: string
  ram: string
  os: string
  gpu?: string
}

function detectHardware(): HardwareInfo {
  const totalMem = os.totalmem()
  const ramGB = Math.round(totalMem / (1024 ** 3))
  let cpu = os.cpus()[0]?.model || 'Unknown CPU'
  let osVersion = os.release()
  let gpu: string | undefined

  if (os.platform() === 'darwin') {
    try {
      cpu = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf-8' }).trim()
      osVersion = execSync('sw_vers -productVersion', { encoding: 'utf-8' }).trim()
      try {
        const gpuInfo = execSync('system_profiler SPDisplaysDataType | grep "Chipset Model"', { encoding: 'utf-8' }).trim()
        const match = gpuInfo.match(/Chipset Model: (.+)/)
        if (match) gpu = match[1]
      } catch {}
    } catch {}
  }

  return {
    cpu,
    ram: `${ramGB} GB`,
    os: `${os.platform() === 'darwin' ? 'macOS' : os.platform()} ${osVersion}`,
    gpu
  }
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
            cases: 0,
            runs: []
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
          
          // Add run detail
          stats.runs.push({
            runId: data.run_id || 'unknown',
            timestamp: data.timestamp,
            packName: data.name || 'Unknown Pack',
            avgScore: totalScore / caseCount,
            avgLatency: totalLatency / caseCount,
            cases: caseCount,
            resultFile: file
          })
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
  const output = opts.output || (format === 'html' ? 'dashboard/published/index.html' : 'leaderboard.md')

  if (format === 'html') {
    const spinner2 = ora('Generating HTML...').start()
    try {
      const hardware = detectHardware()
      const html = generateHTML(sortedModels, files.length, hardware)
      
      // Ensure docs directory exists
      const docsDir = path.dirname(output)
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true })
      }

      fs.writeFileSync(output, html)
      spinner2.succeed(`Generated: ${chalk.cyan(output)}`)
      
      // Generate model detail pages
      const modelsDir = path.join(docsDir, 'models')
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true })
      }
      
      let modelPagesGenerated = 0
      for (const model of sortedModels) {
        const modelHtml = generateModelPage(model, hardware)
        const modelFile = path.join(modelsDir, `${model.model.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.html`)
        fs.writeFileSync(modelFile, modelHtml)
        modelPagesGenerated++
      }
      
      console.log(chalk.green(`  ✓ Generated ${modelPagesGenerated} model detail pages`))
      
      // Generate per-run reports
      const runsDir = path.join(docsDir, 'runs')
      if (!fs.existsSync(runsDir)) {
        fs.mkdirSync(runsDir, { recursive: true })
      }
      
      const spinner3 = ora('Generating run reports...').start()
      let runReportsGenerated = 0
      const allResults: Record<string, RunResult[]> = {} // Track results by model
      
      for (const file of files) {
        try {
          const filePath = path.join(resultsPublic, file)
          const result: RunResult = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          
          const reportHtml = generateRunReport(result)
          const reportFile = path.join(runsDir, `${result.run_id}.html`)
          fs.writeFileSync(reportFile, reportHtml)
          runReportsGenerated++
          
          // Track results for each model
          for (const modelId of result.models) {
            if (!allResults[modelId]) allResults[modelId] = []
            allResults[modelId].push(result)
          }
        } catch (err) {
          spinner3.warn(`Skipped report for ${file}: ${err}`)
        }
      }
      
      spinner3.succeed(`Generated ${runReportsGenerated} run reports`)
      
      // Regenerate model pages with best cases
      const spinner4 = ora('Adding best cases to model pages...').start()
      for (const model of sortedModels) {
        const modelResults = allResults[model.model] || []
        const modelHtml = generateModelPage(model, hardware, modelResults)
        const modelFile = path.join(modelsDir, `${model.model.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.html`)
        fs.writeFileSync(modelFile, modelHtml)
      }
      spinner4.succeed(`Enhanced ${sortedModels.length} model pages with best cases`)
      
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
function generateHTML(models: ModelStats[], totalResults: number, hardware: HardwareInfo): string {
  const now = new Date().toISOString().split('T')[0]
  
  const rows = models.map((stats, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
    const modelSlug = stats.model.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    return `
      <tr>
        <td>${medal}</td>
        <td><strong><a href="models/${modelSlug}.html" style="color: #2c3e50; text-decoration: none;">${stats.model}</a></strong></td>
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
    <div style="background: #ecf0f1; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
      <h3 style="color: #2c3e50; margin-bottom: 1rem;">⚙️ Test Hardware</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; text-align: left; max-width: 800px; margin: 0 auto;">
        <div>
          <strong>CPU:</strong><br>${hardware.cpu}
        </div>
        <div>
          <strong>Memory:</strong><br>${hardware.ram}
        </div>
        <div>
          <strong>OS:</strong><br>${hardware.os}
        </div>
        ${hardware.gpu ? `<div><strong>GPU:</strong><br>${hardware.gpu}</div>` : ''}
      </div>
    </div>
    <p>Powered by <a href="https://github.com/hnshah/verdict" target="_blank">Verdict</a></p>
    <p>Data: <a href="../results/public/" target="_blank">JSON Results</a></p>
  </footer>
</body>
</html>`
}

/**
 * Generate model detail page
 */
function generateModelPage(model: ModelStats, hardware: HardwareInfo, results: RunResult[] = []): string {
  const now = new Date().toISOString().split('T')[0]
  const displayName = getModelDisplayName(model.model)
  const hfLink = getHuggingFaceLink(model.model)
  const ollamaLink = getOllamaLink(model.model)
  
  // Sort runs by timestamp (newest first)
  const sortedRuns = [...model.runs].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  
  const runRows = sortedRuns.map(run => {
    const date = new Date(run.timestamp).toLocaleDateString()
    const time = new Date(run.timestamp).toLocaleTimeString()
    return `
      <tr>
        <td>${date}<br><small style="color: #7f8c8d;">${time}</small></td>
        <td><a href="../runs/${run.runId}.html" style="color: #3498db;">${run.packName}</a></td>
        <td><strong>${run.avgScore.toFixed(1)}</strong></td>
        <td>${Math.round(run.avgLatency)}ms</td>
        <td>${run.cases}</td>
        <td><a href="../../results/public/${run.resultFile}" target="_blank" style="color: #3498db;">JSON</a></td>
      </tr>`
  }).join('')
  
  return `<!DOCTYPE html>
<!-- Generated by Verdict - https://github.com/hnshah/verdict -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${model.model} - Verdict Benchmarks</title>
  <meta name="description" content="Benchmark results for ${model.model}">
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
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #2c3e50;
    }
    .stat-label {
      color: #7f8c8d;
      font-size: 0.9rem;
      margin-top: 0.5rem;
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
    .back-link {
      display: inline-block;
      margin-bottom: 2rem;
      color: #3498db;
      text-decoration: none;
      font-weight: 500;
    }
    .back-link:hover {
      text-decoration: underline;
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
    @media (max-width: 768px) {
      body { padding: 1rem; }
      h1 { font-size: 1.8rem; }
      .stats { grid-template-columns: 1fr; }
      th, td { padding: 0.75rem 0.5rem; font-size: 0.9rem; }
    }
  </style>
</head>
<body>
  <a href="../index.html" class="back-link">← Back to Leaderboard</a>
  
  <header>
    <h1>${displayName}</h1>
    <p class="subtitle">Benchmark Results</p>
    <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
      ${hfLink ? `<a href="${hfLink}" target="_blank" style="color: #3498db; text-decoration: none; padding: 0.5rem 1rem; background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">🤗 HuggingFace</a>` : ''}
      <a href="${ollamaLink}" target="_blank" style="color: #3498db; text-decoration: none; padding: 0.5rem 1rem; background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">🦙 Ollama</a>
    </div>
  </header>

  <div style="margin: 2rem 0; padding: 1rem; background: #ecf0f1; border-radius: 8px; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
    <span style="padding: 0.5rem 1rem; background: white; border-radius: 4px; font-size: 0.9rem;">🖥️ ${hardware.cpu}</span>
    <span style="padding: 0.5rem 1rem; background: white; border-radius: 4px; font-size: 0.9rem;">💾 ${hardware.ram}</span>
    <span style="padding: 0.5rem 1rem; background: white; border-radius: 4px; font-size: 0.9rem;">🔢 ${model.cases} cases</span>
    <span style="padding: 0.5rem 1rem; background: white; border-radius: 4px; font-size: 0.9rem;">📊 ${model.totalRuns} runs</span>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${model.avgScore.toFixed(1)}</div>
      <div class="stat-label">Average Score</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${Math.round(model.avgLatency)}ms</div>
      <div class="stat-label">Average Latency</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${model.totalRuns}</div>
      <div class="stat-label">Total Runs</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${model.cases}</div>
      <div class="stat-label">Cases Tested</div>
    </div>
  </div>

  <main>
    ${generateBestCases(model.model, results)}
    
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Eval Pack</th>
            <th>Score</th>
            <th>Latency</th>
            <th>Cases</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>${runRows}
        </tbody>
      </table>
    </div>
  </main>

  <footer class="footer">
    <div style="background: #ecf0f1; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
      <h3 style="color: #2c3e50; margin-bottom: 1rem;">⚙️ Test Hardware</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; text-align: left; max-width: 800px; margin: 0 auto;">
        <div>
          <strong>CPU:</strong><br>${hardware.cpu}
        </div>
        <div>
          <strong>Memory:</strong><br>${hardware.ram}
        </div>
        <div>
          <strong>OS:</strong><br>${hardware.os}
        </div>
        ${hardware.gpu ? `<div><strong>GPU:</strong><br>${hardware.gpu}</div>` : ''}
      </div>
    </div>
    <p>Powered by <a href="https://github.com/hnshah/verdict" target="_blank">Verdict</a></p>
  </footer>
</body>
</html>`
}

/**
 * Generate detailed run report (inline copy from report.ts)
 */
function generateRunReport(result: RunResult): string {
  const date = new Date(result.timestamp).toLocaleString()
  
  // Calculate duration
  let totalMs = 0
  for (const c of result.cases) {
    for (const resp of Object.values(c.responses)) {
      totalMs += resp.latency_ms
    }
  }
  const seconds = Math.round(totalMs / 1000)
  const duration = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  
  // Build HTML
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${result.name} - ${result.run_id}</title>
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
    .section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #2c3e50; }
    h2 { font-size: 1.5rem; margin-bottom: 1rem; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 0.5rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    .stat {
      padding: 1rem;
      background: #ecf0f1;
      border-radius: 4px;
    }
    .stat-label {
      font-size: 0.85rem;
      color: #7f8c8d;
      text-transform: uppercase;
    }
    .stat-value {
      font-size: 1.25rem;
      font-weight: 600;
      color: #2c3e50;
      margin-top: 0.25rem;
    }
    .case {
      border: 1px solid #ecf0f1;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      background: #fafafa;
    }
    .case-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .case-id { font-weight: 600; color: #3498db; }
    .score { font-size: 1.5rem; font-weight: 700; color: #27ae60; }
    .label { font-weight: 600; color: #7f8c8d; margin: 1rem 0 0.5rem; }
    .content {
      background: white;
      padding: 1rem;
      border-radius: 4px;
      border-left: 4px solid #3498db;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    pre {
      background: #2c3e50;
      color: #ecf0f1;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ecf0f1; }
    th { background: #34495e; color: white; }
    .back-link { display: inline-block; margin-bottom: 1rem; color: #3498db; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <a href="../index.html" class="back-link">← Back to Leaderboard</a>
  
  <div class="section">
    <h1>${result.name}</h1>
    <p><strong>Run ID:</strong> ${result.run_id}<br>
    <strong>Date:</strong> ${date}<br>
    <strong>Duration:</strong> ${duration}</p>
  </div>`
  
  // Hardware section
  if (result.hardware || result.environment) {
    html += '<div class="section"><h2>⚙️ Test Configuration</h2>'
    
    if (result.hardware) {
      html += '<h3>Hardware</h3><div class="grid">'
      html += `<div class="stat"><div class="stat-label">CPU</div><div class="stat-value">${result.hardware.cpu}</div></div>`
      html += `<div class="stat"><div class="stat-label">RAM</div><div class="stat-value">${result.hardware.ram_gb} GB</div></div>`
      html += `<div class="stat"><div class="stat-label">OS</div><div class="stat-value">${result.hardware.os} ${result.hardware.os_version}</div></div>`
      if (result.hardware.gpu) html += `<div class="stat"><div class="stat-label">GPU</div><div class="stat-value">${result.hardware.gpu}</div></div>`
      html += '</div>'
    }
    
    if (result.environment) {
      html += '<h3>Environment</h3><div class="grid">'
      html += `<div class="stat"><div class="stat-label">Verdict</div><div class="stat-value">${result.environment.verdict_version}</div></div>`
      html += `<div class="stat"><div class="stat-label">Node.js</div><div class="stat-value">${result.environment.node_version}</div></div>`
      if (result.environment.provider_versions.ollama) {
        html += `<div class="stat"><div class="stat-label">Ollama</div><div class="stat-value">${result.environment.provider_versions.ollama}</div></div>`
      }
      html += '</div>'
    }
    
    html += '</div>'
  }
  
  // Overall results
  html += '<div class="section"><h2>📊 Overall Results</h2><table><thead><tr>'
  html += '<th>Model</th><th>Score</th><th>Accuracy</th><th>Completeness</th><th>Conciseness</th><th>Latency</th></tr></thead><tbody>'
  
  for (const [modelId, summary] of Object.entries(result.summary)) {
    html += `<tr>
      <td><strong>${modelId}</strong></td>
      <td><strong>${summary.avg_total.toFixed(1)}</strong></td>
      <td>${summary.avg_accuracy.toFixed(1)}</td>
      <td>${summary.avg_completeness.toFixed(1)}</td>
      <td>${summary.avg_conciseness.toFixed(1)}</td>
      <td>${Math.round(summary.avg_latency_ms)}ms</td>
    </tr>`
  }
  html += '</tbody></table></div>'
  
  // Detailed cases
  html += '<div class="section"><h2>🔬 Detailed Results</h2>'
  
  for (const c of result.cases) {
    const modelIds = Object.keys(c.responses)
    const firstModel = modelIds[0]
    const score = c.scores[firstModel]
    const response = c.responses[firstModel]
    
    html += `<div class="case">
      <div class="case-header">
        <div class="case-id">${c.case_id}</div>
        <div class="score">${score.total.toFixed(1)}/10</div>
      </div>
      <div class="label">📝 Prompt</div>
      <div class="content">${escapeHtml(c.prompt)}</div>
      <div class="label">📋 Criteria</div>
      <div class="content">${escapeHtml(c.criteria)}</div>
      <div class="label">💬 Model Response</div>
      <div class="content">${escapeHtml(response.text)}</div>
      <div class="label">⚖️ Judge Reasoning</div>
      <div class="content">${escapeHtml(score.reasoning)}</div>
      <div class="grid" style="margin-top: 1rem;">
        <div class="stat"><div class="stat-label">Accuracy</div><div class="stat-value">${score.accuracy}/10</div></div>
        <div class="stat"><div class="stat-label">Completeness</div><div class="stat-value">${score.completeness}/10</div></div>
        <div class="stat"><div class="stat-label">Conciseness</div><div class="stat-value">${score.conciseness}/10</div></div>
        <div class="stat"><div class="stat-label">Latency</div><div class="stat-value">${Math.round(response.latency_ms)}ms</div></div>
      </div>
    </div>`
  }
  html += '</div>'
  
  // Reproducibility
  if (result.reproducibility) {
    html += '<div class="section"><h2>🔄 Reproducibility</h2>'
    html += `<p>Run this exact benchmark again:</p><pre><code>${escapeHtml(result.reproducibility.command)}</code></pre>`
    html += '</div>'
  }
  
  html += '</body></html>'
  return html
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Generate best cases section for model page
 */
function generateBestCases(modelId: string, results: RunResult[]): string {
  if (results.length === 0) return ''
  
  // Collect all cases for this model across all results
  const allCases: Array<{case: any, score: any, response: any, result: RunResult}> = []
  
  for (const result of results) {
    for (const c of result.cases) {
      if (c.scores[modelId] && c.responses[modelId]) {
        allCases.push({
          case: c,
          score: c.scores[modelId],
          response: c.responses[modelId],
          result
        })
      }
    }
  }
  
  // Sort by score (highest first)
  allCases.sort((a, b) => b.score.total - a.score.total)
  
  // Take top 2 cases
  const topCases = allCases.slice(0, 2)
  
  if (topCases.length === 0) return ''
  
  let html = `
    <div class="card" style="border-left: 4px solid #27ae60;">
      <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: #27ae60;">⭐ Best Performance</h2>
      <p style="color: #7f8c8d; margin-bottom: 1.5rem;">Showing top ${topCases.length} cases by score</p>`
  
  for (const {case: c, score, response} of topCases) {
    const scorePercent = (score.total / 10) * 100
    html += `
      <div style="margin-bottom: 2rem; padding: 1.5rem; background: #f8f9fa; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.1rem; color: #2c3e50;">${c.case_id}</h3>
          <div style="font-size: 1.5rem; font-weight: 700; color: #27ae60;">${score.total.toFixed(1)}/10</div>
        </div>
        
        <div style="margin: 1rem 0;">
          <strong style="color: #7f8c8d;">📝 Prompt:</strong>
          <pre style="background: white; padding: 1rem; border-radius: 4px; margin-top: 0.5rem; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(c.prompt)}</pre>
        </div>
        
        <div style="margin: 1rem 0;">
          <strong style="color: #7f8c8d;">📋 Criteria:</strong>
          <pre style="background: white; padding: 1rem; border-radius: 4px; margin-top: 0.5rem; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(c.criteria)}</pre>
        </div>
        
        <div style="margin: 1rem 0;">
          <strong style="color: #7f8c8d;">💬 Model Response:</strong>
          <pre style="background: #2c3e50; color: #ecf0f1; padding: 1rem; border-radius: 4px; margin-top: 0.5rem; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;"><code>${escapeHtml(response.text)}</code></pre>
        </div>
        
        <div style="margin: 1rem 0;">
          <strong style="color: #7f8c8d;">⚖️ Judge Reasoning:</strong>
          <div style="background: white; padding: 1rem; border-radius: 4px; margin-top: 0.5rem; border-left: 4px solid #27ae60;">${escapeHtml(score.reasoning)}</div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
          <div style="text-align: center; padding: 0.75rem; background: white; border-radius: 4px;">
            <div style="font-size: 0.85rem; color: #7f8c8d;">Accuracy</div>
            <div style="font-size: 1.25rem; font-weight: 600; color: #2c3e50;">${score.accuracy}/10</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: white; border-radius: 4px;">
            <div style="font-size: 0.85rem; color: #7f8c8d;">Completeness</div>
            <div style="font-size: 1.25rem; font-weight: 600; color: #2c3e50;">${score.completeness}/10</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: white; border-radius: 4px;">
            <div style="font-size: 0.85rem; color: #7f8c8d;">Conciseness</div>
            <div style="font-size: 1.25rem; font-weight: 600; color: #2c3e50;">${score.conciseness}/10</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: white; border-radius: 4px;">
            <div style="font-size: 0.85rem; color: #7f8c8d;">Latency</div>
            <div style="font-size: 1.25rem; font-weight: 600; color: #2c3e50;">${Math.round(response.latency_ms)}ms</div>
          </div>
        </div>
      </div>`
  }
  
  html += `</div>`
  return html
}
