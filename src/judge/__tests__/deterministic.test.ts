import { describe, it, expect } from 'vitest'
import {
  scoreJson,
  scoreExact,
  scoreContains,
  scoreFuzzyMatch,
  scoreToolCall,
  scoreJsonSchema,
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

    it('gives partial credit for malformed JSON-like output', () => {
      const result = scoreJson('{key: value}')
      expect(result.total).toBe(2)
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
