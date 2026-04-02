import { describe, it, expect } from 'vitest'
import {
  scoreJson,
  scoreExact,
  scoreContains,
  scoreFuzzyMatch,
  scoreRegex,
  scoreToolCall,
  scoreJsonSchema,
  scoreJavascript,
  scoreStartsWith,
  scoreEndsWith,
  scoreLatency,
  scoreCost,
  isDeterministic,
  scoreDeterministic,
} from '../deterministic.js'

describe('deterministic scorers', () => {
  describe('scoreJson', () => {
    it('scores valid JSON as 10/10', () => {
      const result = scoreJson('{"key": "value"}')
      expect(result.total).toBe(10)
    })

    it('scores valid JSON array as 10/10', () => {
      const result = scoreJson('[1, 2, 3]')
      expect(result.total).toBe(10)
    })

    it('scores JSON with markdown fences as 10/10', () => {
      const result = scoreJson('```json\n{"key": "value"}\n```')
      expect(result.total).toBe(10)
    })

    it('gives 0/10 for malformed JSON-like output (no partial credit)', () => {
      const result = scoreJson('{key: value}')
      expect(result.total).toBe(0)
      expect(result.reasoning).toContain('JSON-like structure found but failed to parse')
      expect(result.reasoning).toContain('{key: value}')
    })

    it('scores non-JSON as 0/10', () => {
      const result = scoreJson('This is plain text')
      expect(result.total).toBe(0)
    })

    it('handles empty string', () => {
      const result = scoreJson('')
      expect(result.total).toBe(0)
    })

    it('handles whitespace-only input', () => {
      const result = scoreJson('   \n\t  ')
      expect(result.total).toBe(0)
    })
  })

  describe('scoreExact', () => {
    it('scores exact match as 10/10', () => {
      const result = scoreExact('hello world', 'hello world')
      expect(result.total).toBe(10)
    })

    it('is case-insensitive', () => {
      const result = scoreExact('Hello World', 'hello world')
      expect(result.total).toBe(10)
    })

    it('trims whitespace', () => {
      const result = scoreExact('  hello  ', 'hello')
      expect(result.total).toBe(10)
    })

    it('scores mismatch as 0/10', () => {
      const result = scoreExact('hello', 'goodbye')
      expect(result.total).toBe(0)
    })

    it('includes expected vs actual in reasoning on failure', () => {
      const result = scoreExact('got', 'want')
      expect(result.reasoning).toContain('want')
      expect(result.reasoning).toContain('got')
    })
  })

  describe('scoreContains', () => {
    it('scores substring match as 10/10', () => {
      const result = scoreContains('The answer is 42 and more', '42')
      expect(result.total).toBe(10)
    })

    it('is case-insensitive', () => {
      const result = scoreContains('Hello World', 'hello')
      expect(result.total).toBe(10)
    })

    it('scores missing substring as 0/10', () => {
      const result = scoreContains('Hello World', 'goodbye')
      expect(result.total).toBe(0)
    })

    it('handles empty expected', () => {
      const result = scoreContains('anything', '')
      expect(result.total).toBe(10)
    })
  })

  describe('scoreToolCall', () => {
    it('scores no tool calls as 0/10', () => {
      const result = scoreToolCall(undefined, 'get_weather')
      expect(result.total).toBe(0)
    })

    it('scores empty tool calls as 0/10', () => {
      const result = scoreToolCall([], 'get_weather')
      expect(result.total).toBe(0)
    })

    it('scores wrong tool as 2/10', () => {
      const result = scoreToolCall(
        [{ name: 'wrong_tool', arguments: {} }],
        'get_weather'
      )
      expect(result.total).toBe(2)
    })

    it('scores correct tool with no expected args as 6/10', () => {
      const result = scoreToolCall(
        [{ name: 'get_weather', arguments: { city: 'NYC' } }],
        'get_weather'
      )
      expect(result.total).toBe(6)
    })

    it('scores correct tool with correct args as 10/10', () => {
      const result = scoreToolCall(
        [{ name: 'get_weather', arguments: { city: 'NYC', unit: 'celsius' } }],
        'get_weather',
        { city: 'NYC', unit: 'celsius' }
      )
      expect(result.total).toBe(10)
    })

    it('scores correct tool with partial args correctly', () => {
      const result = scoreToolCall(
        [{ name: 'get_weather', arguments: { city: 'NYC', unit: 'fahrenheit' } }],
        'get_weather',
        { city: 'NYC', unit: 'celsius' }
      )
      // 4 (correct tool) + 2 (valid format) + 2 (city correct) = 8
      expect(result.total).toBe(8)
    })

    it('caps arg points at 4', () => {
      const result = scoreToolCall(
        [{ name: 'fn', arguments: { a: 1, b: 2, c: 3, d: 4 } }],
        'fn',
        { a: 1, b: 2, c: 3, d: 4 }
      )
      // 4 + 2 + min(4, 8) = 10
      expect(result.total).toBe(10)
    })
  })

  describe('scoreJsonSchema', () => {
    it('scores valid matching schema as 10/10', () => {
      const output = '{"name": "John", "age": 30}'
      const schema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      }
      const result = scoreJsonSchema(output, schema)
      expect(result.total).toBe(10)
    })

    it('deducts 2pts per missing required field', () => {
      const output = '{"name": "John"}'
      const schema = {
        required: ['name', 'age', 'email'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string' },
        },
      }
      const result = scoreJsonSchema(output, schema)
      // Missing age and email: 10 - 4 = 6
      expect(result.total).toBe(6)
    })

    it('deducts 1pt per wrong type', () => {
      const output = '{"name": 123, "age": "thirty"}'
      const schema = {
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      }
      const result = scoreJsonSchema(output, schema)
      // 2 wrong types: 10 - 2 = 8
      expect(result.total).toBe(8)
    })

    it('scores invalid JSON as 0/10', () => {
      const result = scoreJsonSchema('not json', {})
      expect(result.total).toBe(0)
    })

    it('scores non-object JSON as 0/10', () => {
      const result = scoreJsonSchema('[1, 2, 3]', {})
      expect(result.total).toBe(0)
    })

    it('handles JSON with markdown fences', () => {
      const output = '```json\n{"name": "John"}\n```'
      const schema = {
        required: ['name'],
        properties: { name: { type: 'string' } },
      }
      const result = scoreJsonSchema(output, schema)
      expect(result.total).toBe(10)
    })

    it('does not go below 0', () => {
      const output = '{}'
      const schema = {
        required: ['a', 'b', 'c', 'd', 'e', 'f'],
        properties: {},
      }
      const result = scoreJsonSchema(output, schema)
      expect(result.total).toBe(0)
    })
  })

  describe('isDeterministic', () => {
    it('returns true for deterministic scorers', () => {
      expect(isDeterministic('json')).toBe(true)
      expect(isDeterministic('exact')).toBe(true)
      expect(isDeterministic('contains')).toBe(true)
      expect(isDeterministic('jsonschema')).toBe(true)
      expect(isDeterministic('tool_call')).toBe(true)
    })

    it('returns false for non-deterministic scorers', () => {
      expect(isDeterministic('llm')).toBe(false)
      expect(isDeterministic('unknown')).toBe(false)
    })
  })

  describe('scoreDeterministic', () => {
    it('dispatches to scoreJson', () => {
      const result = scoreDeterministic('json', '{"key": "value"}')
      expect(result).not.toBeNull()
      expect(result!.total).toBe(10)
    })

    it('dispatches to scoreExact', () => {
      const result = scoreDeterministic('exact', 'hello', 'hello')
      expect(result).not.toBeNull()
      expect(result!.total).toBe(10)
    })

    it('dispatches to scoreContains', () => {
      const result = scoreDeterministic('contains', 'hello world', 'world')
      expect(result).not.toBeNull()
      expect(result!.total).toBe(10)
    })

    it('dispatches to scoreJsonSchema', () => {
      const result = scoreDeterministic('jsonschema', '{"a": 1}', undefined, { required: ['a'], properties: { a: { type: 'number' } } })
      expect(result).not.toBeNull()
      expect(result!.total).toBe(10)
    })

    it('returns null for unknown scorer', () => {
      const result = scoreDeterministic('llm', 'text')
      expect(result).toBeNull()
    })
  })
})

  describe('scoreFuzzyMatch', () => {
    it('passes when output contains expected', () => {
      const result = scoreFuzzyMatch('The answer is Paris, France', 'Paris')
      expect(result.total).toBe(10)
    })

    it('passes when expected contains output (reverse direction)', () => {
      const result = scoreFuzzyMatch('Paris', 'Paris, France')
      expect(result.total).toBe(10)
    })

    it('is case-insensitive', () => {
      const result = scoreFuzzyMatch('PARIS', 'paris')
      expect(result.total).toBe(10)
    })

    it('fails when neither string contains the other', () => {
      const result = scoreFuzzyMatch('Berlin', 'Paris')
      expect(result.total).toBe(0)
    })

    it('passes on exact match', () => {
      const result = scoreFuzzyMatch('42', '42')
      expect(result.total).toBe(10)
    })
  })

  describe('scoreRegex', () => {
    it('passes when output matches a raw pattern', () => {
      const result = scoreRegex('The answer is 42', '\\d+')
      expect(result.total).toBe(10)
    })

    it('fails when output does not match', () => {
      const result = scoreRegex('no digits here', '^\\d+$')
      expect(result.total).toBe(0)
    })

    it('supports /pattern/flags syntax (case-insensitive)', () => {
      const result = scoreRegex('Hello World', '/hello/i')
      expect(result.total).toBe(10)
    })

    it('returns 0 with explanation on invalid regex', () => {
      const result = scoreRegex('test', '[invalid(')
      expect(result.total).toBe(0)
      expect(result.reasoning).toMatch(/Invalid regex/)
    })

    it('scoreDeterministic dispatches to regex scorer', () => {
      const result = scoreDeterministic('regex', 'foo123bar', '\\d+')
      expect(result?.total).toBe(10)
    })

    it('isDeterministic returns true for regex', () => {
      expect(isDeterministic('regex')).toBe(true)
    })
  })

  describe('scoreJavascript', () => {
    it('returns score from valid function body', () => {
      const result = scoreJavascript('hello', undefined, 'return output === "hello" ? 10 : 0')
      expect(result.total).toBe(10)
    })

    it('uses expected parameter', () => {
      const result = scoreJavascript('hello', 'hello', 'return output === expected ? 10 : 0')
      expect(result.total).toBe(10)
    })

    it('returns 0 when expected does not match', () => {
      const result = scoreJavascript('hello', 'world', 'return output === expected ? 10 : 0')
      expect(result.total).toBe(0)
    })

    it('clamps score to 0-10 range', () => {
      const result = scoreJavascript('test', undefined, 'return 99')
      expect(result.total).toBe(10)
    })

    it('clamps negative scores to 0', () => {
      const result = scoreJavascript('test', undefined, 'return -5')
      expect(result.total).toBe(0)
    })

    it('returns 0 with error message when function throws', () => {
      const result = scoreJavascript('test', undefined, 'throw new Error("boom")')
      expect(result.total).toBe(0)
      expect(result.reasoning).toContain('boom')
    })

    it('returns 0 when function returns non-number', () => {
      const result = scoreJavascript('test', undefined, 'return "not a number"')
      expect(result.total).toBe(0)
      expect(result.reasoning).toContain('must return a number')
    })

    it('returns 0 when function returns NaN', () => {
      const result = scoreJavascript('test', undefined, 'return NaN')
      expect(result.total).toBe(0)
      expect(result.reasoning).toContain('must return a number')
    })

    it('returns 0 when code is empty string', () => {
      const result = scoreJavascript('test', undefined, '')
      expect(result.total).toBe(0)
      expect(result.reasoning).toContain('must return a number')
    })

    it('sets all dimensions equal to total', () => {
      const result = scoreJavascript('test', undefined, 'return 7')
      expect(result.accuracy).toBe(7)
      expect(result.completeness).toBe(7)
      expect(result.conciseness).toBe(7)
      expect(result.total).toBe(7)
    })

    it('isDeterministic returns true for javascript', () => {
      expect(isDeterministic('javascript')).toBe(true)
    })

    it('scoreDeterministic dispatches to javascript scorer', () => {
      const result = scoreDeterministic('javascript', 'hello', 'hello', undefined, undefined, 'return output === expected ? 10 : 0')
      expect(result?.total).toBe(10)
    })
  })

describe('scoreLatency', () => {
  it('passes when latency is within threshold', () => {
    expect(scoreLatency(500, 1000).total).toBe(10)
  })
  it('passes when latency equals threshold exactly', () => {
    expect(scoreLatency(1000, 1000).total).toBe(10)
  })
  it('returns 0 at 2x threshold', () => {
    expect(scoreLatency(2000, 1000).total).toBe(0)
  })
  it('returns partial score between threshold and 2x', () => {
    const score = scoreLatency(1500, 1000).total
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(10)
  })
})

describe('scoreCost', () => {
  it('passes when cost is within threshold', () => {
    expect(scoreCost(0.0005, 0.001).total).toBe(10)
  })
  it('passes when cost equals threshold exactly', () => {
    expect(scoreCost(0.001, 0.001).total).toBe(10)
  })
  it('returns 0 at 2x threshold', () => {
    expect(scoreCost(0.002, 0.001).total).toBe(0)
  })
  it('returns partial score between threshold and 2x', () => {
    const score = scoreCost(0.0015, 0.001).total
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(10)
  })
})
