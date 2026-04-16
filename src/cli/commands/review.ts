/**
 * Verdict Review Command
 *
 * `cat code.js | verdict review`
 * Review code with a coding-specialized model, produce structured output.
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
  output?: string
}

export async function reviewCommand(code: string, opts: ReviewOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' review'))
  console.log()

  if (!code.trim()) {
    console.error(chalk.red('  No code provided. Pipe code via stdin: `cat file.js | verdict review`'))
    process.exit(1)
  }

  // Load config
  let config
  try {
    config = loadConfig(opts.config)
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  // Find review model
  const modelId = opts.model || 'deepcoder-14b'
  const modelConfig = config.models.find(m => m.id === modelId)

  if (!modelConfig) {
    // Fall back to first coding model in config
    const fallback = config.models.find(m =>
      m.id.includes('coder') || m.id.includes('deepseek') || m.tags?.includes('coding')
    )
    if (!fallback) {
      console.error(chalk.red(`  Model '${modelId}' not found and no coding model available in config`))
      process.exit(1)
    }
  }

  const model = modelConfig || fallback!
  console.log(chalk.dim(`  Using ${model.id} (${model.provider})\n`))

  // Build the prompt
  const prompt = `You are an expert code reviewer. Analyze the following code and provide a structured review.

Return your response as JSON in this exact format:
{
  "overallScore": <1-10 score for code quality>,
  "summary": "<2-3 sentence summary of the code>",
  "bugs": [
    {
      "severity": "critical|high|medium|low",
      "type": "<bug type like 'memory leak', 'null check', 'off-by-one'>",
      "location": "<approximate location or 'throughout'>",
      "description": "<one sentence describing the bug>",
      "suggestion": "<how to fix it>"
    }
  ],
  "suggestions": ["<improvement suggestion 1>", "..."],
  "strengths": ["<what the code does well 1>", "..."]
}

Code to review:
\`\`\`${code.slice(-3000)}
\`\`\`

Respond ONLY with JSON. No markdown, no explanation outside the JSON.`

  // Run the model
  const spinner = ora({ prefixText: '  ', text: 'Analyzing code...' }).start()

  let result: ReviewResult

  try {
    const response = await callModel(model, prompt, {
      maxTokens: opts.maxTokens || 2000,
    })

    spinner.succeed(`Review complete (${response.latency_ms}ms)`)

    // Try to parse JSON from response
    let text = response.text.trim()

    // Strip markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || text.match(/^(\{[\s\S]*\})$/)
    if (jsonMatch) {
      text = jsonMatch[1] || jsonMatch[0]
    }

    result = JSON.parse(text)
  } catch (err) {
    spinner.warn(chalk.yellow('  Could not parse structured output, showing raw response'))
    console.log()
    console.log(chalk.dim('  ─'.repeat(40)))
    console.log('  ' + (response?.text || String(err)).split('\n').join('\n  '))
    console.log(chalk.dim('  ─'.repeat(40)))
    return
  }

  // Display output
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  // Pretty display
  const scoreColor = result.overallScore >= 8 ? chalk.green : result.overallScore >= 5 ? chalk.yellow : chalk.red
  console.log()
  console.log(`  ${chalk.bold('Score:')} ${scoreColor(`${result.overallScore}/10`)}`)
  console.log(`  ${chalk.bold('Summary:')} ${chalk.dim(result.summary)}`)
  console.log()

  if (result.bugs.length > 0) {
    console.log(chalk.bold(`  🐛 Bugs (${result.bugs.length})`))
    for (const bug of result.bugs) {
      const sevColor = bug.severity === 'critical' ? chalk.red : bug.severity === 'high' ? chalk.orange : bug.severity === 'medium' ? chalk.yellow : chalk.dim
      console.log(`    ${sevColor(`[${bug.severity.toUpperCase()}]`)} ${chalk.bold(bug.type)} — ${bug.description}`)
      console.log(`      ${chalk.dim('→')} ${chalk.cyan(bug.suggestion)}`)
    }
    console.log()
  }

  if (result.strengths.length > 0) {
    console.log(chalk.bold(`  ✅ Strengths`))
    for (const s of result.strengths) {
      console.log(`    ${chalk.green('●')} ${s}`)
    }
    console.log()
  }

  if (result.suggestions.length > 0) {
    console.log(chalk.bold(`  💡 Suggestions`))
    for (const s of result.suggestions) {
      console.log(`    ${chalk.blue('○')} ${s}`)
    }
    console.log()
  }

  console.log(chalk.dim('  ─'.repeat(40)))
  console.log(chalk.dim(`  Model: ${model.id} · ${response?.latency_ms || '?'}ms · ${result.bugs.length} bugs found`))
  console.log()
}
