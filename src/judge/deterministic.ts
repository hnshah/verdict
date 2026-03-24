import type { JudgeScore } from '../types/index.js'

/**
 * Deterministic scorers that don't require an LLM.
 * Used when a case has scorer: 'json', 'exact', or 'contains'.
 *
 * These return scores on the same 0-10 scale as the LLM judge,
 * but scoring is binary: pass (10/10) or fail (0/10).
 */

export function scoreJson(output: string): JudgeScore {
  const text = output.trim()
  // Strip markdown code fences if present
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  try {
    JSON.parse(stripped)
    return {
      accuracy: 10, completeness: 10, conciseness: 10, total: 10,
      reasoning: 'Valid JSON output.',
    }
  } catch (err) {
    // Give partial credit for near-misses (the json structure is there but malformed)
    const looksLikeJson = stripped.startsWith('{') || stripped.startsWith('[')
    if (looksLikeJson) {
      return {
        accuracy: 2, completeness: 2, conciseness: 2, total: 2,
        reasoning: `JSON structure detected but parse failed: ${err instanceof Error ? err.message : err}`,
      }
    }
    return {
      accuracy: 0, completeness: 0, conciseness: 0, total: 0,
      reasoning: `Not JSON: ${stripped.slice(0, 60)}`,
    }
  }
}

export function scoreExact(output: string, expected: string): JudgeScore {
  const got = output.trim().toLowerCase()
  const want = expected.trim().toLowerCase()
  if (got === want) {
    return {
      accuracy: 10, completeness: 10, conciseness: 10, total: 10,
      reasoning: 'Exact match.',
    }
  }
  return {
    accuracy: 0, completeness: 0, conciseness: 0, total: 0,
    reasoning: `Expected "${expected.slice(0, 40)}", got "${output.trim().slice(0, 40)}"`,
  }
}

export function scoreContains(output: string, expected: string): JudgeScore {
  const got = output.toLowerCase()
  const want = expected.toLowerCase()
  if (got.includes(want)) {
    return {
      accuracy: 10, completeness: 10, conciseness: 10, total: 10,
      reasoning: `Contains expected string "${expected.slice(0, 40)}".`,
    }
  }
  return {
    accuracy: 0, completeness: 0, conciseness: 0, total: 0,
    reasoning: `Does not contain "${expected.slice(0, 40)}"`,
  }
}

export function isDeterministic(scorer: string): boolean {
  return scorer === 'json' || scorer === 'exact' || scorer === 'contains'
}

export function scoreDeterministic(
  scorer: string, output: string, expected?: string
): JudgeScore | null {
  if (scorer === 'json') return scoreJson(output)
  if (scorer === 'exact') return scoreExact(output, expected ?? '')
  if (scorer === 'contains') return scoreContains(output, expected ?? '')
  return null
}
