/**
 * Verdict Review Command
 *
 * Usage:
 *   verdict review --file code.js
 *   cat code.js | verdict review
 *   echo "const x = 1" | verdict review
 *
 * Reviews code with a coding-specialized model, produces structured output.
 */

import chalk from 'chalk'
import ora from 'ora'
import { loadConfig } from '../../core/config.js'
import { callModel } from '../../providers/compat.js'
import fs from 'fs'
import readline from 'readline'

interface ReviewOptions {
  config: string
  model?: string
  maxTokens?: number
  json?: boolean
  file?: string
}

interface Bug {
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: string
  location: string
  description: string
  suggestion: string
}

interface ReviewResult {
  overallScore: number
  summary: string
  bugs: Bug[]
  suggestions: string[]
  strengths: string[]
}

export async function reviewCommand(code: string, opts: ReviewOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' review'))
  console.log()

  if (!code.trim()) {
    console.error(chalk.red('  No code provided. Use --file or pipe code via stdin.'))
    console.error(chalk.dim('  Examples:'))
    console.error(chalk.dim('    verdict review --file code.js'))
    console.error(chalk.dim('    cat code.js | verdict review'))
    process.exit(1)
  }

  // Load config
  let config
  try {
    config = loadConfig(opts.config)
  } catch (err) {
    console.error(chalk.red(`  Config error: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  // Find review model — prefer deepcoder, fall back to any coding model
  const modelId = opts.model || 'deepcoder-14b'
  let modelConfig = config.models.find(m => m.id === modelId)

  if (!modelConfig) {
    // Try to find any available coding model
    const candidates = [
      'deepcoder-14b', 'qwen2.5-coder:14b', 'qwen2.5-coder:7b',
      'qwen-coder-7b', 'qwen-coder-14b', 'qwen2.5-coder:32b',
    ]
    for (const cid of candidates) {
      const found = config.models.find(m => m.id === cid)
      if (found) { modelConfig = found; break }
    }
  }

  if (!modelConfig) {
    // Last resort: first model in config
    modelConfig = config.models[0]
    if (!modelConfig) {
      console.error(chalk.red('  No models found in config. Run `verdict models discover` first.'))
      process.exit(1)
    }
    console.log(chalk.yellow(`  No coding model specified, using '${modelConfig.id}' from config\n`))
  } else {
    console.log(chalk.dim(`  Model: ${modelConfig.id} (${modelConfig.provider})\n`))
  }

  // Build the prompt — truncate to last 4000 chars to avoid token limits
  const truncatedCode = code.length > 4000 ? code.slice(-4000) : code
  const prompt = `You are an expert code reviewer. Analyze the following code and provide a structured review.

Return your response as JSON in this exact format (no markdown, no explanation outside JSON):
{
  "overallScore": <1-10 score for code quality>,
  "summary": "<2-3 sentence summary of the code>",
  "bugs": [
    {
      "severity": "critical|high|medium|low",
      "type": "<bug type like 'memory leak', 'null check', 'off-by-one', 'type error'>",
      "location": "<approximate line or function name, or 'throughout'>",
      "description": "<one sentence describing the bug>",
      "suggestion": "<how to fix it>"
    }
  ],
  "suggestions": ["<improvement suggestion 1>", "..."],
  "strengths": ["<what the code does well 1>", "..."]
}

Code to review:
\`\`\`
${truncatedCode}
\`\`\`

Respond ONLY with valid JSON. No markdown code blocks, no text outside the JSON object.`

  // Run the model
  const spinner = ora({ prefixText: '  ', text: 'Analyzing code...' }).start()

  let response: { text: string; latency_ms: number } | undefined
  let result: ReviewResult

  try {
    response = await callModel(modelConfig!, prompt, {
      maxTokens: opts.maxTokens || 2000,
    })

    spinner.succeed(`Review complete (${response.latency_ms}ms)`)

    // Parse JSON from response
    let text = response.text.trim()

    // Try JSON in various positions
    let parsed = false
    for (const pattern of [/```json\s*\n?([\s\S]*?)\n?```/, /```\s*\n?([\s\S]*?)\n?```/, /(\{[\s\S]*\})/]) {
      const m = text.match(pattern)
      if (m && m[1]) {
        try {
          result = JSON.parse(m[1].trim())
          parsed = true
          break
        } catch { /* try next pattern */ }
      }
    }

    if (!parsed) {
      throw new Error('Could not parse JSON from model response')
    }
  } catch (err) {
    spinner.fail(chalk.red(`Review failed: ${err instanceof Error ? err.message : String(err)}`))
    if (response) {
      console.log(chalk.dim('\n  Raw response:'))
      console.log('  ' + response.text.slice(0, 500).split('\n').join('\n  '))
    }
    process.exit(1)
  }

  // Output
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  // Pretty display
  const scoreColor = result.overallScore >= 8 ? chalk.green : result.overallScore >= 5 ? chalk.yellow : chalk.red
  const scoreEmoji = result.overallScore >= 8 ? '✅' : result.overallScore >= 5 ? '⚠️' : '🚨'

  console.log()
  console.log(`  ${chalk.bold('Score:')} ${scoreColor(`${result.overallScore}/10`)} ${scoreEmoji}`)
  console.log(`  ${chalk.bold('Summary:')} ${chalk.dim(result.summary)}`)
  console.log()

  if (result.bugs.length > 0) {
    console.log(chalk.bold(`  🐛 Bugs (${result.bugs.length})`))
    for (const bug of result.bugs) {
      const sevColorFn = {
        critical: chalk.red,
        high: chalk.orange,
        medium: chalk.yellow,
        low: chalk.dim,
      }[bug.severity as string] ?? chalk.dim
      const sevPad = bug.severity.toUpperCase().padEnd(8)
      console.log(`    ${sevColorFn(`[${sevPad}]`)} ${chalk.bold(bug.type)}`)
      console.log(`      ${chalk.dim('→')} ${bug.description}`)
      console.log(`      ${chalk.dim('✓')} ${chalk.cyan(bug.suggestion)}`)
    }
    console.log()
  } else {
    console.log(chalk.green('  ✅ No bugs found — code looks clean!'))
    console.log()
  }

  if (result.strengths.length > 0) {
    console.log(chalk.bold(`  ✅ Strengths`))
    for (const s of result.strengths.slice(0, 3)) {
      console.log(`    ${chalk.green('●')} ${s}`)
    }
    console.log()
  }

  if (result.suggestions.length > 0) {
    console.log(chalk.bold(`  💡 Suggestions`))
    for (const s of result.suggestions.slice(0, 3)) {
      console.log(`    ${chalk.blue('○')} ${s}`)
    }
    console.log()
  }

  console.log(chalk.dim('  ─'.repeat(40)))
  console.log(chalk.dim(`  ${modelConfig!.id} · ${response.latency_ms}ms · ${result.bugs.length} bugs · ${code.split('\n').length} lines`))
  console.log()
}
