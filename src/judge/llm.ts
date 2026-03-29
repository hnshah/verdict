import OpenAI from 'openai'
import type { ModelConfig, JudgeConfig, JudgeScore } from '../types/index.js'
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
  const baseURL = judgeModel.base_url
  if (!baseURL) throw new Error(`Judge model '${judgeModel.id}' has no base_url`)

  const apiKey = judgeModel.api_key === 'none' ? 'no-key-required' : (judgeModel.api_key ?? 'ollama')
  const client = getOrCreateJudgeClient(baseURL, apiKey)

  const judgePrompt = buildPrompt(prompt, criteria, response, config.rubric)
  vlog('debug', `judge ${judgeModel.id}: request`, judgePrompt)

  const result = await client.chat.completions.create({
    model: judgeModel.model,
    messages: [{ role: 'user', content: judgePrompt }],
    max_tokens: 256,
    temperature: 0.0,
  })

  const text = result.choices[0]?.message?.content ?? ''
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
