import OpenAI from 'openai'
import type { ModelConfig, JudgeConfig, RunResult, SynthesisResult, BaselineComparison } from '../types/index.js'

function buildSynthesisPrompt(
  question: string,
  result: RunResult,
  baselineDelta?: BaselineComparison
): string {
  const sorted = result.models
    .map(id => result.summary[id])
    .filter(Boolean)
    .sort((a, b) => b.avg_total - a.avg_total)

  const leaderboard = sorted.map((s, i) =>
    `${i + 1}. ${s.model_id}: score=${s.avg_total}, accuracy=${s.avg_accuracy}, completeness=${s.avg_completeness}, conciseness=${s.avg_conciseness}, latency=${(s.avg_latency_ms / 1000).toFixed(1)}s, cost=$${s.total_cost_usd.toFixed(4)}, win_rate=${s.win_rate}%`
  ).join('\n')

  let baselineSection = ''
  if (baselineDelta) {
    const deltaLines = baselineDelta.deltas.map(d =>
      `  ${d.model}: ${d.scoreA.toFixed(2)} → ${d.scoreB.toFixed(2)} (${d.delta > 0 ? '+' : ''}${d.delta.toFixed(2)}, ${d.pctChange > 0 ? '+' : ''}${d.pctChange.toFixed(1)}%)${d.regression ? ' ⚠️ REGRESSION' : ''}`
    ).join('\n')
    baselineSection = `\n\nBaseline comparison (vs "${baselineDelta.baselineName}"):\n${deltaLines}`
    if (baselineDelta.newModels.length > 0) baselineSection += `\nNew models: ${baselineDelta.newModels.join(', ')}`
    if (baselineDelta.removedModels.length > 0) baselineSection += `\nRemoved models: ${baselineDelta.removedModels.join(', ')}`
  }

  return `You are an eval analyst. Answer the user's question based on these benchmark results.

Question: ${question}

Leaderboard (${result.cases.length} cases, ${result.models.length} models):
${leaderboard}${baselineSection}

Respond with ONLY a JSON object (no markdown, no other text):
{"verdict":"CLEAR|LEAN|INCONCLUSIVE","recommendation":"1-2 sentence plain-English answer","confidence":"HIGH|MEDIUM|LOW","keyFinding":"single most important data point","caveats":"what this run cannot tell you"}

Rules for verdict:
- CLEAR: One option is obviously better (score gap ≥ 1.0 or decisive cost/quality tradeoff)
- LEAN: Slight advantage but close (gap < 1.0)
- INCONCLUSIVE: Too close to call or insufficient data`
}

function parseSynthesisJson(text: string): SynthesisResult | null {
  const cleaned = text
    .replace(/```(?:json)?/gi, '')
    .replace(/\[\d+\]/g, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch { /* fall through */ }

  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null

  try {
    return JSON.parse(cleaned.slice(first, last + 1))
  } catch { /* fall through */ }

  return null
}

export async function synthesizeRun(
  judgeModel: ModelConfig,
  judgeConfig: JudgeConfig,
  question: string,
  result: RunResult,
  baselineDelta?: BaselineComparison
): Promise<SynthesisResult> {
  const baseURL = judgeModel.base_url
  if (!baseURL) throw new Error(`Judge model '${judgeModel.id}' has no base_url`)

  const client = new OpenAI({
    baseURL,
    apiKey: judgeModel.api_key === 'none' ? 'no-key-required' : judgeModel.api_key,
    timeout: judgeModel.timeout_ms,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/hnshah/verdict',
      'X-Title': 'verdict',
    },
  })

  const prompt = buildSynthesisPrompt(question, result, baselineDelta)

  const response = await client.chat.completions.create({
    model: judgeModel.model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 512,
    temperature: 0.0,
  })

  const text = response.choices[0]?.message?.content ?? ''
  const parsed = parseSynthesisJson(text)
  if (!parsed) throw new Error(`Synthesis returned non-JSON: ${text.slice(0, 200)}`)

  const validVerdicts = ['CLEAR', 'LEAN', 'INCONCLUSIVE'] as const
  const validConfidence = ['HIGH', 'MEDIUM', 'LOW'] as const

  return {
    verdict: validVerdicts.includes(parsed.verdict as typeof validVerdicts[number])
      ? parsed.verdict
      : 'INCONCLUSIVE',
    recommendation: String(parsed.recommendation ?? ''),
    confidence: validConfidence.includes(parsed.confidence as typeof validConfidence[number])
      ? parsed.confidence
      : 'MEDIUM',
    keyFinding: String(parsed.keyFinding ?? ''),
    caveats: String(parsed.caveats ?? ''),
  }
}
