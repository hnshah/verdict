import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import type { RunResult } from '../../types/index.js'

interface ReportOptions {
  result: string
  output?: string
}

/**
 * Generate detailed HTML report from a result file
 */
export async function reportCommand(opts: ReportOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' report'))
  console.log()

  const resultPath = path.resolve(opts.result)
  
  if (!fs.existsSync(resultPath)) {
    console.error(chalk.red(`  ✗ Result file not found: ${opts.result}`))
    process.exit(1)
  }

  const spinner = ora('Loading result...').start()
  
  // Load result JSON
  let result: RunResult
  try {
    const content = fs.readFileSync(resultPath, 'utf-8')
    result = JSON.parse(content)
  } catch (err) {
    spinner.fail(`Failed to parse result: ${err}`)
    process.exit(1)
  }

  spinner.text = 'Generating HTML report...'

  // Generate HTML
  const html = generateDetailedReport(result)

  // Determine output path
  const outputPath = opts.output || path.join('dashboard/published/runs', `${result.run_id}.html`)
  
  // Ensure directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write file
  fs.writeFileSync(outputPath, html)

  spinner.succeed(`Generated: ${chalk.cyan(outputPath)}`)
  
  console.log()
  console.log(chalk.green('  ✓ Report ready!'))
  console.log(`    Open: ${chalk.cyan(`file://${path.resolve(outputPath)}`)}`)
  console.log()
}

/**
 * Generate detailed HTML report
 */
export function generateDetailedReport(result: RunResult): string {
  const date = new Date(result.timestamp).toLocaleString()
  const duration = calculateDuration(result)
  
  // Build sections
  const metadataSection = buildMetadataSection(result)
  const overallSection = buildOverallSection(result)
  const casesSection = buildCasesSection(result)
  const reproducibilitySection = buildReproducibilitySection(result)
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${result.name} - ${result.run_id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
    }
    header {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #2c3e50;
    }
    .run-meta {
      color: #7f8c8d;
      font-size: 0.9rem;
    }
    .section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 0.5rem;
    }
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
      letter-spacing: 0.5px;
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
      align-items: center;
      margin-bottom: 1rem;
    }
    .case-id {
      font-weight: 600;
      color: #3498db;
    }
    .score {
      font-size: 1.5rem;
      font-weight: 700;
      color: #27ae60;
    }
    pre {
      background: #2c3e50;
      color: #ecf0f1;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.9rem;
    }
    code {
      font-family: 'Monaco', 'Courier New', monospace;
    }
    .prompt, .criteria, .response, .reasoning {
      margin: 1rem 0;
    }
    .label {
      font-weight: 600;
      color: #7f8c8d;
      margin-bottom: 0.5rem;
    }
    .content {
      background: white;
      padding: 1rem;
      border-radius: 4px;
      border-left: 4px solid #3498db;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #ecf0f1;
    }
    th {
      background: #34495e;
      color: white;
      font-weight: 600;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .back-link {
      display: inline-block;
      margin-bottom: 1rem;
      color: #3498db;
      text-decoration: none;
      font-weight: 500;
    }
    .back-link:hover {
      text-decoration: underline;
    }
    @media print {
      body { background: white; }
      .section { box-shadow: none; border: 1px solid #ddd; }
    }
  </style>
</head>
<body>
  <a href="../index.html" class="back-link">← Back to Leaderboard</a>
  
  <header>
    <h1>${result.name}</h1>
    <div class="run-meta">
      <strong>Run ID:</strong> ${result.run_id}<br>
      <strong>Date:</strong> ${date}<br>
      <strong>Duration:</strong> ${duration}
    </div>
  </header>

  ${metadataSection}
  ${overallSection}
  ${casesSection}
  ${reproducibilitySection}

  <div class="section">
    <h2>📄 Raw Data</h2>
    <p>Full results in JSON format:</p>
    <p><a href="../../results/public/${result.run_id}.json" target="_blank">Download JSON</a></p>
  </div>
</body>
</html>`
}

function calculateDuration(result: RunResult): string {
  // Calculate from case latencies
  let totalMs = 0
  for (const c of result.cases) {
    for (const resp of Object.values(c.responses)) {
      totalMs += resp.latency_ms
    }
  }
  
  const seconds = Math.round(totalMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s`
}

function buildMetadataSection(result: RunResult): string {
  if (!result.hardware && !result.environment && !result.eval_pack) {
    return '' // No metadata available
  }

  let html = '<div class="section"><h2>⚙️ Test Configuration</h2>'
  
  // Hardware
  if (result.hardware) {
    html += `
    <h3>Hardware</h3>
    <div class="grid">
      <div class="stat">
        <div class="stat-label">CPU</div>
        <div class="stat-value">${result.hardware.cpu}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Cores</div>
        <div class="stat-value">${result.hardware.cpu_cores}</div>
      </div>
      <div class="stat">
        <div class="stat-label">RAM</div>
        <div class="stat-value">${result.hardware.ram_gb} GB</div>
      </div>
      <div class="stat">
        <div class="stat-label">OS</div>
        <div class="stat-value">${result.hardware.os} ${result.hardware.os_version}</div>
      </div>
      ${result.hardware.gpu ? `<div class="stat"><div class="stat-label">GPU</div><div class="stat-value">${result.hardware.gpu}</div></div>` : ''}
    </div>`
  }
  
  // Environment
  if (result.environment) {
    html += `
    <h3>Environment</h3>
    <div class="grid">
      <div class="stat">
        <div class="stat-label">Verdict</div>
        <div class="stat-value">${result.environment.verdict_version}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Node.js</div>
        <div class="stat-value">${result.environment.node_version}</div>
      </div>
      ${result.environment.provider_versions.ollama ? `<div class="stat"><div class="stat-label">Ollama</div><div class="stat-value">${result.environment.provider_versions.ollama}</div></div>` : ''}
      ${result.environment.provider_versions.mlx ? `<div class="stat"><div class="stat-label">MLX</div><div class="stat-value">${result.environment.provider_versions.mlx}</div></div>` : ''}
    </div>`
  }
  
  // Eval Pack
  if (result.eval_pack) {
    html += `
    <h3>Eval Pack</h3>
    <div class="grid">
      <div class="stat">
        <div class="stat-label">File</div>
        <div class="stat-value">${result.eval_pack.file}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total Cases</div>
        <div class="stat-value">${result.eval_pack.total_cases}</div>
      </div>
      ${result.eval_pack.description ? `<div class="stat"><div class="stat-label">Description</div><div class="stat-value">${result.eval_pack.description}</div></div>` : ''}
    </div>`
  }
  
  // Judge
  if (result.judge) {
    html += `
    <h3>Judge Configuration</h3>
    <div class="grid">
      <div class="stat">
        <div class="stat-label">Judge Model</div>
        <div class="stat-value">${result.judge.model}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Temperature</div>
        <div class="stat-value">${result.judge.temperature}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Scoring Dimensions</div>
        <div class="stat-value">${result.judge.scoring_dimensions.join(', ')}</div>
      </div>
    </div>`
  }
  
  html += '</div>'
  return html
}

function buildOverallSection(result: RunResult): string {
  const models = Object.values(result.summary)
  
  let html = '<div class="section"><h2>📊 Overall Results</h2><table><thead><tr>'
  html += '<th>Model</th><th>Score</th><th>Accuracy</th><th>Completeness</th><th>Conciseness</th><th>Latency</th><th>Cases</th>'
  html += '</tr></thead><tbody>'
  
  for (const model of models) {
    html += `<tr>
      <td><strong>${model.model_id}</strong></td>
      <td><strong>${model.avg_total.toFixed(1)}</strong></td>
      <td>${model.avg_accuracy.toFixed(1)}</td>
      <td>${model.avg_completeness.toFixed(1)}</td>
      <td>${model.avg_conciseness.toFixed(1)}</td>
      <td>${Math.round(model.avg_latency_ms)}ms</td>
      <td>${model.cases_run}</td>
    </tr>`
  }
  
  html += '</tbody></table></div>'
  return html
}

function buildCasesSection(result: RunResult): string {
  let html = '<div class="section"><h2>🔬 Detailed Results</h2>'
  
  for (const c of result.cases) {
    const modelIds = Object.keys(c.responses)
    const firstModel = modelIds[0]
    const score = c.scores[firstModel]
    const response = c.responses[firstModel]
    
    html += `
    <div class="case">
      <div class="case-header">
        <div class="case-id">${c.case_id}</div>
        <div class="score">${score.total.toFixed(1)}/10</div>
      </div>
      
      <div class="prompt">
        <div class="label">📝 Prompt</div>
        <div class="content">${escapeHtml(c.prompt)}</div>
      </div>
      
      <div class="criteria">
        <div class="label">📋 Criteria</div>
        <div class="content">${escapeHtml(c.criteria)}</div>
      </div>
      
      <div class="response">
        <div class="label">💬 Model Response</div>
        <div class="content">${escapeHtml(response.text)}</div>
      </div>
      
      <div class="reasoning">
        <div class="label">⚖️ Judge Reasoning</div>
        <div class="content">${escapeHtml(score.reasoning)}</div>
      </div>
      
      <div class="grid" style="margin-top: 1rem;">
        <div class="stat">
          <div class="stat-label">Accuracy</div>
          <div class="stat-value">${score.accuracy}/10</div>
        </div>
        <div class="stat">
          <div class="stat-label">Completeness</div>
          <div class="stat-value">${score.completeness}/10</div>
        </div>
        <div class="stat">
          <div class="stat-label">Conciseness</div>
          <div class="stat-value">${score.conciseness}/10</div>
        </div>
        <div class="stat">
          <div class="stat-label">Latency</div>
          <div class="stat-value">${Math.round(response.latency_ms)}ms</div>
        </div>
      </div>
    </div>`
  }
  
  html += '</div>'
  return html
}

function buildReproducibilitySection(result: RunResult): string {
  if (!result.reproducibility) return ''
  
  let html = '<div class="section"><h2>🔄 Reproducibility</h2>'
  
  html += `<p>Run this exact benchmark again:</p>
  <pre><code>${escapeHtml(result.reproducibility.command)}</code></pre>`
  
  html += '<h3>Model Configurations</h3><table><thead><tr>'
  html += '<th>Model ID</th><th>Provider</th><th>Model</th><th>Temperature</th><th>Max Tokens</th>'
  html += '</tr></thead><tbody>'
  
  for (const [modelId, config] of Object.entries(result.reproducibility.model_configs)) {
    html += `<tr>
      <td><strong>${modelId}</strong></td>
      <td>${config.provider || 'N/A'}</td>
      <td>${config.model}</td>
      <td>${config.temperature || 'N/A'}</td>
      <td>${config.max_tokens}</td>
    </tr>`
  }
  
  html += '</tbody></table></div>'
  return html
}

function escapeHtml(text: string): string {
  const div = { innerHTML: '', textContent: text } as any
  return div.innerHTML || text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
