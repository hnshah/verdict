import OpenAI from 'openai'
import type { JudgeScore } from '../types/index.js'

export interface EmbeddingConfig {
  base_url: string
  api_key: string
  model: string
}

const embeddingClientCache = new Map<string, OpenAI>()

function getOrCreateEmbeddingClient(baseUrl: string, apiKey: string): OpenAI {
  const key = `${baseUrl}:::${apiKey}`
  if (!embeddingClientCache.has(key)) {
    embeddingClientCache.set(key, new OpenAI({
      baseURL: baseUrl,
      apiKey,
      timeout: 30_000,
    }))
  }
  return embeddingClientCache.get(key)!
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
  const magA = Math.sqrt(a.reduce((s, x) => s + x * x, 0))
  const magB = Math.sqrt(b.reduce((s, x) => s + x * x, 0))
  if (magA === 0 || magB === 0) return 0
  return dot / (magA * magB)
}

export async function scoreSimilar(
  output: string,
  expected: string,
  threshold: number,
  embeddingConfig: EmbeddingConfig
): Promise<JudgeScore> {
  try {
    const client = getOrCreateEmbeddingClient(embeddingConfig.base_url, embeddingConfig.api_key)
    const resp = await client.embeddings.create({
      model: embeddingConfig.model,
      input: [output, expected],
    })

    const [vecA, vecB] = [resp.data[0].embedding, resp.data[1].embedding]
    const similarity = cosineSimilarity(vecA, vecB)
    const score = similarity >= threshold
      ? 10
      : Math.max(0, Math.round((similarity / threshold) * 10))

    return {
      accuracy: score,
      completeness: score,
      conciseness: score,
      total: score,
      reasoning: `Cosine similarity ${similarity.toFixed(3)} vs threshold ${threshold} → ${score}/10`,
    }
  } catch (err) {
    // Fallback to contains scorer when embeddings unavailable
    const contains = output.toLowerCase().includes(expected.toLowerCase())
    const fallbackScore = contains ? 7 : 0
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      accuracy: fallbackScore,
      completeness: fallbackScore,
      conciseness: fallbackScore,
      total: fallbackScore,
      reasoning: `[embedding fallback: ${errMsg.slice(0, 80)}] ${contains ? 'Contains expected text.' : 'Does not contain expected text.'}`,
    }
  }
}
