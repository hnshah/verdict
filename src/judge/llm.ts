import OpenAI from 'openai'
import type { ModelConfig, JudgeConfig, JudgeScore } from '../types/index.js'

function buildPrompt(prompt: string, criteria: string, response: string, rubric: JudgeConfig['rubric']): string {
  return `You are an impartial evaluator. You do not know which AI model produced this response.

Question: ${prompt}

Evaluation Criteria: ${criteria}

Response: ${response}

Score on three dimensions (1-10 each):
1. Accuracy (${Math.round(rubric.accuracy * 100)}% weight): Is the content correct and factual?
2. Completeness (${Math.round(rubric.completeness * 100)}% weight): Does it address all criteria?
3. Conciseness (${Math.round(rubric.conciseness * 100)}% weight): Appropriately scoped, no padding?

Respond ONLY with valid JSON, no other text:
{"accuracy":<n>,"completeness":<n>,"conciseness":<n>,"reasoning":"<one sentence>"}`
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

  const client = new OpenAI({
    baseURL,
    apiKey: judgeModel.api_key === 'none' ? 'no-key-required' : judgeModel.api_key,
    timeout: 30_000,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/hnshah/verdict',
      'X-Title': 'verdict',
    },
  })

  const result = await client.chat.completions.create({
    model: judgeModel.model,
    messages: [{ role: 'user', content: buildPrompt(prompt, criteria, response, config.rubric) }],
    max_tokens: 256,
    temperature: 0.0,
  })

  const text = result.choices[0]?.message?.content ?? ''
  const match = text.match(/\{[\s\S]*?\}/)
  if (!match) throw new Error(`Judge returned non-JSON: ${text.slice(0, 200)}`)

  const parsed = JSON.parse(match[0]) as {
    accuracy: number; completeness: number; conciseness: number; reasoning: string
  }
  const { rubric } = config
  const total = +(
    parsed.accuracy * rubric.accuracy * 10 +
    parsed.completeness * rubric.completeness * 10 +
    parsed.conciseness * rubric.conciseness * 10
  ).toFixed(1)

  return {
    accuracy: parsed.accuracy,
    completeness: parsed.completeness,
    conciseness: parsed.conciseness,
    total,
    reasoning: parsed.reasoning ?? '',
  }
}
