import OpenAI from 'openai'
import type { ModelConfig, JudgeConfig, JudgeScore, CotChoice } from '../types/index.js'
import { callOpenClaw, type OpenClawConfig } from '../providers/openclaw.js'
import { callSubAgent, type SubAgentConfig } from '../providers/subagent.js'
import { log as vlog } from '../utils/logger.js'

const judgeClientCache = new Map<string, OpenAI>()

function getOrCreateJudgeClient(baseUrl: string, apiKey: string): OpenAI {
  const key = baseUrl + ':::' + apiKey
  if (!judgeClientCache.has(key)) {
    judgeClientCache.set(key, new OpenAI({
      baseURL: baseUrl,
      apiKey,
      timeout: 30_000,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/hnshah/verdict',
        'X-Title': 'verdict',
      },
    }))
  }
  return judgeClientCache.get(key)!
}

export function clearJudgeClientCache(): void {
  judgeClientCache.clear()
}

function buildPrompt(prompt: string, criteria: string, response: string, rubric: JudgeConfig['rubric']): string {
  return `You are an impartial evaluator. You do not know which AI model produced this response.

Question: ${prompt}

Evaluation Criteria: ${criteria}

Response to evaluate:
${response}

Score on three dimensions. Use integers 1-10.
- accuracy (${Math.round(rubric.accuracy * 100)}% weight): Is the content correct and factual?
- completeness (${Math.round(rubric.completeness * 100)}% weight): Does it address all criteria?
- conciseness (${Math.round(rubric.conciseness * 100)}% weight): Appropriately scoped, no padding?

Output ONLY a JSON object on a single line. No markdown, no citations, no other text:
{"accuracy":N,"completeness":N,"conciseness":N,"reasoning":"one sentence"}`
}

function parseJudgeJson(text: string): { accuracy: number; completeness: number; conciseness: number; reasoning: string } | null {
  // Strip markdown fences and citation markers (e.g. [1][2][3] from Perplexity)
  const cleaned = text
    .replace(/```(?:json)?/gi, '')
    .replace(/\[\d+\]/g, '')
    .trim()

  // Try direct parse first
  try {
    return JSON.parse(cleaned)
  } catch { /* fall through */ }

  // Find the outermost JSON object (greedy match, handles nested braces in reasoning)
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null

  try {
    return JSON.parse(cleaned.slice(first, last + 1))
  } catch { /* fall through */ }

  return null
}

export async function judgeResponse(
  judgeModel: ModelConfig,
  config: JudgeConfig,
  prompt: string,
  criteria: string,
  response: string
): Promise<JudgeScore> {
  const judgePrompt = buildPrompt(prompt, criteria, response, config.rubric)
  vlog('debug', `judge ${judgeModel.id}: request`, judgePrompt)

  let text: string

  // Route to OpenClaw if provider is openclaw
  if (judgeModel.provider === 'openclaw') {
    const result = await callOpenClaw(judgePrompt, judgeModel as OpenClawConfig)
    text = result.text
  } else if (judgeModel.provider === 'subagent') {
    // Route to sub-agent if provider is subagent
    const result = await callSubAgent(judgePrompt, judgeModel as SubAgentConfig)
    text = result.text
  } else {
    // Standard OpenAI-compatible path
    const baseURL = judgeModel.base_url
    if (!baseURL) throw new Error(`Judge model '${judgeModel.id}' has no base_url`)

    const apiKey = judgeModel.api_key === 'none' ? 'no-key-required' : (judgeModel.api_key ?? 'ollama')
    const client = getOrCreateJudgeClient(baseURL, apiKey)

    const result = await client.chat.completions.create({
      model: judgeModel.model,
      messages: [{ role: 'user', content: judgePrompt }],
      max_tokens: 256,
      temperature: 0.0,
    })

    text = result.choices[0]?.message?.content ?? ''
  }
  vlog('debug', `judge ${judgeModel.id}: response`, text)
  const parsed = parseJudgeJson(text)
  if (!parsed) throw new Error(`Judge returned non-JSON: ${text.slice(0, 200)}`)

  // Clamp and normalize scores to 0-10 range
  const clamp = (n: unknown) => {
    const v = typeof n === 'number' ? n : parseFloat(String(n))
    return isNaN(v) ? 5 : Math.min(10, Math.max(0, v))
  }

  const accuracy = clamp(parsed.accuracy)
  const completeness = clamp(parsed.completeness)
  const conciseness = clamp(parsed.conciseness)

  const { rubric } = config
  // Weighted average: scores are 0-10, weights sum to 1.0, result is 0-10
  const total = +(
    accuracy * rubric.accuracy +
    completeness * rubric.completeness +
    conciseness * rubric.conciseness
  ).toFixed(1)

  return {
    accuracy,
    completeness,
    conciseness,
    total,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
  }
}

// ─── Chain-of-thought classify ──────────────────────────────────────────────

const DEFAULT_COT_CHOICES: CotChoice[] = [
  { letter: 'A', score: 0 },
  { letter: 'B', score: 2 },
  { letter: 'C', score: 5 },
  { letter: 'D', score: 8 },
  { letter: 'E', score: 10 },
]

export function buildCotPrompt(
  prompt: string,
  criteria: string,
  response: string,
  choices: CotChoice[]
): string {
  const choiceList = choices.map(c => c.letter).join(', ')
  const bandDesc = choices.map(c => `${c.letter} = ${c.score}/10`).join(', ')

  return `You are an impartial evaluator. You do not know which AI model produced this response.

Question: ${prompt}

Evaluation Criteria: ${criteria}

Response to evaluate:
${response}

First, reason step-by-step about the quality of the response. Consider accuracy, completeness, and conciseness relative to the criteria. Write your reasoning in plain text — do NOT output any structured format yet.

After your reasoning, pick exactly one letter from [${choiceList}] that best represents the overall quality.
The score bands are: ${bandDesc}.

On the very last line of your response, output ONLY the single letter of your choice. Nothing else on that line.`
}

export function extractCotChoice(text: string, choices: CotChoice[]): CotChoice | null {
  const validLetters = new Set(choices.map(c => c.letter.toUpperCase()))

  // Look at the last non-empty line
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return null

  const lastLine = lines[lines.length - 1].toUpperCase()
  // Check if last line is exactly a single valid letter
  if (lastLine.length === 1 && validLetters.has(lastLine)) {
    return choices.find(c => c.letter.toUpperCase() === lastLine) ?? null
  }

  // Fallback: check if last line starts with a letter followed by non-alpha (e.g. "A." or "A)")
  const match = lastLine.match(/^([A-Z])(?:\W|$)/)
  if (match && validLetters.has(match[1])) {
    return choices.find(c => c.letter.toUpperCase() === match[1]) ?? null
  }

  // Last resort: scan from the end for any standalone valid letter
  for (let i = lines.length - 1; i >= 0; i--) {
    const lineUpper = lines[i].toUpperCase()
    // Match a standalone letter (word boundary on both sides)
    for (const choice of choices) {
      const letter = choice.letter.toUpperCase()
      const regex = new RegExp(`\\b${letter}\\b`)
      if (regex.test(lineUpper) && lineUpper.length <= 3) {
        return choice
      }
    }
  }

  return null
}

export async function judgeResponseCot(
  judgeModel: ModelConfig,
  config: JudgeConfig,
  prompt: string,
  criteria: string,
  response: string,
  cotChoices?: CotChoice[]
): Promise<JudgeScore> {
  const choices = cotChoices && cotChoices.length > 0 ? cotChoices : DEFAULT_COT_CHOICES

  let text: string

  // Route to OpenClaw if provider is openclaw
  if (judgeModel.provider === 'openclaw') {
    const result = await callOpenClaw(buildCotPrompt(prompt, criteria, response, choices), judgeModel as OpenClawConfig)
    text = result.text
  } else {
    const baseURL = judgeModel.base_url
    if (!baseURL) throw new Error(`Judge model '${judgeModel.id}' has no base_url`)

    const apiKey = judgeModel.api_key === 'none' ? 'no-key-required' : (judgeModel.api_key ?? 'ollama')
    const client = getOrCreateJudgeClient(baseURL, apiKey)

    const result = await client.chat.completions.create({
      model: judgeModel.model,
      messages: [{ role: 'user', content: buildCotPrompt(prompt, criteria, response, choices) }],
      max_tokens: 1024,
      temperature: 0.0,
    })

    text = result.choices[0]?.message?.content ?? ''
  }

  const chosen = extractCotChoice(text, choices)
  if (!chosen) {
    throw new Error(`cot_classify: could not extract choice from judge response. Last 200 chars: ${text.slice(-200)}`)
  }

  const score = Math.min(10, Math.max(0, chosen.score))

  // Extract reasoning: everything before the final choice line
  const lines = text.split('\n')
  const reasoningLines = lines.slice(0, -1).filter(l => l.trim().length > 0)
  const reasoning = reasoningLines.length > 0
    ? reasoningLines[reasoningLines.length - 1].slice(0, 200)
    : `Chose ${chosen.letter}`

  return {
    accuracy: score,
    completeness: score,
    conciseness: score,
    total: score,
    reasoning: `[cot_classify=${chosen.letter}] ${reasoning}`,
  }
}
