import type { JudgeScore, ToolCallResult } from '../types/index.js'

/**
 * Deterministic scorers that don't require an LLM.
 * Used when a case has scorer: 'json', 'exact', or 'contains'.
 *
 * These return scores on the same 0-10 scale as the LLM judge,
 * but scoring is binary: pass (10/10) or fail (0/10).
 */

/**
 * Extract JSON from text that may contain markdown fences and surrounding text.
 * Handles:
 * - ```json ... ```
 * - ``` ... ```
 * - JSON surrounded by explanatory text
 */
function extractJson(text: string): string | null {
  const trimmed = text.trim()
  
  // Try to find JSON in markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch) {
    return fenceMatch[1].trim()
  }
  
  // Try to find JSON object/array in the text (greedy match for largest valid JSON)
  const jsonObjectMatch = trimmed.match(/\{[\s\S]*\}/)
  if (jsonObjectMatch) {
    return jsonObjectMatch[0].trim()
  }
  
  const jsonArrayMatch = trimmed.match(/\[[\s\S]*\]/)
  if (jsonArrayMatch) {
    return jsonArrayMatch[0].trim()
  }
  
  return null
}

export function scoreJson(output: string): JudgeScore {
  const extracted = extractJson(output)
  
  if (!extracted) {
    return {
      accuracy: 0, completeness: 0, conciseness: 0, total: 0,
      reasoning: `No JSON found in output: ${output.trim().slice(0, 60)}`,
    }
  }

  try {
    JSON.parse(extracted)
    return {
      accuracy: 10, completeness: 10, conciseness: 10, total: 10,
      reasoning: 'Valid JSON output.',
    }
  } catch (err) {
    return {
      accuracy: 2, completeness: 2, conciseness: 2, total: 2,
      reasoning: `JSON structure found but parse failed: ${err instanceof Error ? err.message : err}`,
    }
  }
}

export function scoreExact(output: string, expected: string | string[]): JudgeScore {
  const got = output.trim().toLowerCase()
  const candidates = Array.isArray(expected) ? expected : [expected]
  for (const candidate of candidates) {
    if (got === candidate.trim().toLowerCase()) {
      return {
        accuracy: 10, completeness: 10, conciseness: 10, total: 10,
        reasoning: 'Exact match.',
      }
    }
  }
  const label = candidates.length === 1 ? candidates[0].slice(0, 40) : `[${candidates.map(c => c.slice(0, 20)).join(', ')}]`
  return {
    accuracy: 0, completeness: 0, conciseness: 0, total: 0,
    reasoning: `Expected "${label}", got "${output.trim().slice(0, 40)}"`,
  }
}

export function scoreContains(output: string, expected: string | string[]): JudgeScore {
  const got = output.toLowerCase()
  const candidates = Array.isArray(expected) ? expected : [expected]
  for (const candidate of candidates) {
    if (got.includes(candidate.toLowerCase())) {
      return {
        accuracy: 10, completeness: 10, conciseness: 10, total: 10,
        reasoning: `Contains expected string "${candidate.slice(0, 40)}".`,
      }
    }
  }
  const label = candidates.length === 1 ? candidates[0].slice(0, 40) : `[${candidates.map(c => c.slice(0, 20)).join(', ')}]`
  return {
    accuracy: 0, completeness: 0, conciseness: 0, total: 0,
    reasoning: `Does not contain "${label}"`,
  }
}

export function scoreToolCall(
  toolCalls: ToolCallResult[] | undefined,
  expectedTool: string,
  expectedArgs?: Record<string, unknown>
): JudgeScore {
  if (!toolCalls || toolCalls.length === 0) {
    // If we expected NO tool call (empty string), this is correct!
    if (expectedTool === '') {
      return {
        accuracy: 10, completeness: 10, conciseness: 10, total: 10,
        reasoning: 'Correctly avoided calling any tool.',
      }
    }
    return {
      accuracy: 0, completeness: 0, conciseness: 0, total: 0,
      reasoning: 'No tool calls made.',
    }
  }

  // Check if any tool call matches the expected tool
  const matchingCall = toolCalls.find(tc => tc.name === expectedTool)
  if (!matchingCall) {
    return {
      accuracy: 2, completeness: 2, conciseness: 2, total: 2,
      reasoning: `Wrong tool called: got '${toolCalls[0].name}', expected '${expectedTool}'.`,
    }
  }

  // Correct tool: +4pts
  let score = 4
  // Valid format: +2pts
  score += 2

  // Each expected arg present with correct value: +2pts (cap at 4pts total from args)
  let argPoints = 0
  const reasons: string[] = [`Correct tool: ${expectedTool}`]
  if (expectedArgs) {
    for (const [key, expectedVal] of Object.entries(expectedArgs)) {
      if (argPoints >= 4) break
      const actualVal = matchingCall.arguments[key]
      if (JSON.stringify(actualVal) === JSON.stringify(expectedVal)) {
        argPoints += 2
        reasons.push(`arg '${key}' correct`)
      } else {
        reasons.push(`arg '${key}': expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(actualVal)}`)
      }
    }
  }
  score += argPoints

  const total = Math.min(score, 10)
  return {
    accuracy: total, completeness: total, conciseness: total, total,
    reasoning: reasons.join('; '),
  }
}

export function scoreJsonSchema(output: string, schema: Record<string, unknown>): JudgeScore {
  const extracted = extractJson(output)
  
  if (!extracted) {
    return {
      accuracy: 0, completeness: 0, conciseness: 0, total: 0,
      reasoning: `No JSON found in output: ${output.trim().slice(0, 60)}`,
    }
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(extracted)
  } catch {
    return {
      accuracy: 0, completeness: 0, conciseness: 0, total: 0,
      reasoning: `JSON parse failed: ${extracted.slice(0, 60)}`,
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      accuracy: 0, completeness: 0, conciseness: 0, total: 0,
      reasoning: 'JSON output is not an object.',
    }
  }

  let missingRequired = 0
  let wrongType = 0
  const reasons: string[] = []

  const required = Array.isArray(schema.required) ? schema.required as string[] : []
  for (const field of required) {
    if (!(field in parsed)) {
      missingRequired++
      reasons.push(`missing required field: ${field}`)
    }
  }

  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>
  for (const [key, propSchema] of Object.entries(properties)) {
    if (!(key in parsed)) continue
    const expectedType = propSchema.type as string | undefined
    if (!expectedType) continue
    const value = parsed[key]
    let actualType: string
    if (Array.isArray(value)) actualType = 'array'
    else if (value === null) actualType = 'null'
    else actualType = typeof value
    if (actualType !== expectedType) {
      wrongType++
      reasons.push(`field '${key}': expected ${expectedType}, got ${actualType}`)
    }
  }

  const total = Math.max(0, 10 - (2 * missingRequired) - (1 * wrongType))
  const reasoning = total === 10
    ? 'JSON matches schema: all required fields present with correct types.'
    : `Schema violations: ${reasons.join('; ')}`

  return {
    accuracy: total, completeness: total, conciseness: total, total,
    reasoning,
  }
}

export function scoreFuzzyMatch(output: string, expected: string | string[]): JudgeScore {
  const a = output.trim().toLowerCase()
  const candidates = Array.isArray(expected) ? expected : [expected]
  for (const candidate of candidates) {
    const b = candidate.trim().toLowerCase()
    if (a.includes(b) || b.includes(a)) {
      return {
        accuracy: 10, completeness: 10, conciseness: 10, total: 10,
        reasoning: `Fuzzy match: "${a.slice(0, 40)}" ↔ "${b.slice(0, 40)}"`,
      }
    }
  }
  const label = candidates.length === 1 ? candidates[0].slice(0, 40) : `[${candidates.map(c => c.slice(0, 20)).join(', ')}]`
  return {
    accuracy: 0, completeness: 0, conciseness: 0, total: 0,
    reasoning: `No fuzzy match: "${a.slice(0, 40)}" does not match "${label}"`,
  }
}

export function scoreMultipleChoice(output: string, expected: string, choices?: string[]): JudgeScore {
  const expectedLetter = expected.trim().toUpperCase()
  const trimmedOutput = output.trim()
  const trimmedUpper = trimmedOutput.toUpperCase()

  if (trimmedUpper === expectedLetter) {
    return {
      accuracy: 10, completeness: 10, conciseness: 10, total: 10,
      reasoning: `Exact match: "${expectedLetter}".`,
    }
  }

  const validLetters = choices
    ? choices.map((_, i) => String.fromCharCode(65 + i))
    : ['A', 'B', 'C', 'D']

  const found: string[] = []
  for (const letter of validLetters) {
    const re = new RegExp(`\\b${letter}\\b`, 'i')
    if (re.test(trimmedOutput)) found.push(letter)
  }

  if (found.length === 0) {
    return {
      accuracy: 0, completeness: 0, conciseness: 0, total: 0,
      reasoning: `No choice letter found in output: "${trimmedOutput.slice(0, 60)}"`,
    }
  }

  if (found.includes(expectedLetter)) {
    return {
      accuracy: 8, completeness: 8, conciseness: 8, total: 8,
      reasoning: `Expected letter "${expectedLetter}" found in output with extra text.`,
    }
  }

  return {
    accuracy: 0, completeness: 0, conciseness: 0, total: 0,
    reasoning: `Wrong choice: expected "${expectedLetter}", found "${found.join(', ')}"`,
  }
}


export function isDeterministic(scorer: string): boolean {
  return scorer === 'json' || scorer === 'exact' || scorer === 'contains' || scorer === 'fuzzy_match' || scorer === 'jsonschema' || scorer === 'tool_call' || scorer === 'multiple_choice'
}

export function scoreDeterministic(
  scorer: string, output: string, expected?: string | string[], schema?: Record<string, unknown>, choices?: string[]
): JudgeScore | null {
  const expectedStr = typeof expected === 'string' ? expected : (expected?.[0] ?? '')
  if (scorer === 'json') return scoreJson(output)
  if (scorer === 'exact') return scoreExact(output, expected ?? '')
  if (scorer === 'contains') return scoreContains(output, expected ?? '')
  if (scorer === 'fuzzy_match') return scoreFuzzyMatch(output, expected ?? '')
  if (scorer === 'jsonschema') return scoreJsonSchema(output, schema ?? {})
  if (scorer === 'multiple_choice') return scoreMultipleChoice(output, expectedStr, choices)
  return null
}
