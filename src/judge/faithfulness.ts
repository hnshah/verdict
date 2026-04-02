import OpenAI from 'openai'
import type { ModelConfig, JudgeConfig, JudgeScore } from '../types/index.js'
import type { OpenClawConfig } from '../providers/openclaw.js'

const faithfulnessClientCache = new Map<string, OpenAI>()

function getOrCreateClient(baseUrl: string, apiKey: string): OpenAI {
  const key = `${baseUrl}:::${apiKey}`
  if (!faithfulnessClientCache.has(key)) {
    faithfulnessClientCache.set(key, new OpenAI({
      baseURL: baseUrl,
      apiKey,
      timeout: 30_000,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/hnshah/verdict',
        'X-Title': 'verdict',
      },
    }))
  }
  return faithfulnessClientCache.get(key)!
}

function buildFaithfulnessPrompt(prompt: string, response: string, context: string): string {
  return `You are evaluating whether an AI response is faithful to the provided source context.

Source Context:
${context}

Question: ${prompt}

Response to evaluate:
${response}

Assess: What percentage of factual claims in the response are directly supported by the source context?
Scoring bands:
- 10/10: All claims grounded in context, no hallucinations
- 7-9/10: Minor unsupported details but mostly grounded
- 4-6/10: Mix of grounded and hallucinated claims
- 1-3/10: Mostly hallucinated claims
- 0/10: Completely fabricated, nothing from context

Output ONLY a JSON object on a single line. No markdown, no other text:
{"score":N,"reasoning":"one sentence explaining grounding level"}`
}

function parseFaithfulnessJson(text: string): { score: number; reasoning: string } | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/\[\d+\]/g, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first === -1 || last <= first) return null
  try { return JSON.parse(cleaned.slice(first, last + 1)) } catch {}
  return null
}

export async function judgeFaithfulness(
  judgeModel: ModelConfig,
  _config: JudgeConfig,
  prompt: string,
  response: string,
  context: string
): Promise<JudgeScore> {
  const faithfulnessPrompt = buildFaithfulnessPrompt(prompt, response, context)

  let text: string

  if (judgeModel.provider === 'openclaw') {
    // Dynamic import to avoid circular dependency issues
    const { callOpenClaw: callOC } = await import('../providers/openclaw.js')
    const result = await callOC(faithfulnessPrompt, judgeModel as OpenClawConfig)
    text = result.text
  } else {
    const baseURL = judgeModel.base_url
    if (!baseURL) throw new Error(`Judge model '${judgeModel.id}' has no base_url`)
    const apiKey = judgeModel.api_key === 'none' ? 'no-key-required' : (judgeModel.api_key ?? 'ollama')
    const client = getOrCreateClient(baseURL, apiKey)
    const result = await client.chat.completions.create({
      model: judgeModel.model,
      messages: [{ role: 'user', content: faithfulnessPrompt }],
      max_tokens: 256,
      temperature: 0.0,
    })
    text = result.choices[0]?.message?.content ?? ''
  }

  const parsed = parseFaithfulnessJson(text)
  if (!parsed) throw new Error(`Faithfulness judge returned non-JSON: ${text.slice(0, 200)}`)

  const score = Math.min(10, Math.max(0, typeof parsed.score === 'number' ? parsed.score : parseFloat(String(parsed.score))))
  return {
    accuracy: score,
    completeness: score,
    conciseness: score,
    total: score,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
  }
}
