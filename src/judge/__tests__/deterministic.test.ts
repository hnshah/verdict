import { describe, it, expect } from 'vitest'
import {
  scoreJson,
  scoreExact,
  scoreContains,
  scoreToolCall,
  scoreJsonSchema,
  scoreMultipleChoice,
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

    it('scores 10/10 when output matches any element in expected array', () => {
      const result = scoreExact('paris', ['Paris', 'paris', 'PARIS'])
      expect(result.total).toBe(10)
    })

    it('scores 0/10 when output matches none of expected array', () => {
      const result = scoreExact('london', ['Paris', 'Berlin'])
      expect(result.total).toBe(0)
    })

    it('handles single-element array same as string', () => {
      const result = scoreExact('hello', ['hello'])
      expect(result.total).toBe(10)
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

    it('scores 10/10 when output contains any element in expected array', () => {
      const result = scoreContains('The answer is 42', ['42', '43', '44'])
      expect(result.total).toBe(10)
    })

    it('scores 0/10 when output contains none of expected array', () => {
      const result = scoreContains('The answer is 42', ['43', '44', '45'])
      expect(result.total).toBe(0)
    })

    it('handles single-element array same as string', () => {
      const result = scoreContains('hello world', ['world'])
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

  describe('scoreMultipleChoice', () => {
    it('scores exact letter match as 10/10', () => {
      const result = scoreMultipleChoice('C', 'C')
      expect(result.total).toBe(10)
      expect(result.reasoning).toContain('Exact match')
    })

    it('is case-insensitive for exact match', () => {
      const result = scoreMultipleChoice('c', 'C')
      expect(result.total).toBe(10)
    })

    it('trims whitespace for exact match', () => {
      const result = scoreMultipleChoice('  B  ', 'B')
      expect(result.total).toBe(10)
    })

    it('scores letter in sentence as 8/10', () => {
      const result = scoreMultipleChoice('The answer is C', 'C')
      expect(result.total).toBe(8)
      expect(result.reasoning).toContain('extra text')
    })

    it('scores wrong letter as 0/10', () => {
      const result = scoreMultipleChoice('A', 'C')
      expect(result.total).toBe(0)
      expect(result.reasoning).toContain('Wrong choice')
      expect(result.reasoning).toContain('"C"')
      expect(result.reasoning).toContain('"A"')
    })

    it('scores no letter found as 0/10', () => {
      const result = scoreMultipleChoice('I think the answer is photosynthesis', 'B')
      expect(result.total).toBe(0)
      expect(result.reasoning).toContain('No choice letter')
    })

    it('handles custom choices array', () => {
      const result = scoreMultipleChoice('E', 'E', ['opt1', 'opt2', 'opt3', 'opt4', 'opt5'])
      expect(result.total).toBe(10)
    })

    it('detects wrong letter in verbose output', () => {
      const result = scoreMultipleChoice('I believe the correct answer is B because...', 'D')
      expect(result.total).toBe(0)
      expect(result.reasoning).toContain('Wrong choice')
    })
  })

  describe('isDeterministic', () => {
    it('returns true for deterministic scorers', () => {
      expect(isDeterministic('json')).toBe(true)
      expect(isDeterministic('exact')).toBe(true)
      expect(isDeterministic('contains')).toBe(true)
      expect(isDeterministic('jsonschema')).toBe(true)
      expect(isDeterministic('tool_call')).toBe(true)
      expect(isDeterministic('multiple_choice')).toBe(true)
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

    it('dispatches to scoreMultipleChoice', () => {
      const result = scoreDeterministic('multiple_choice', 'C', 'C')
      expect(result).not.toBeNull()
      expect(result!.total).toBe(10)
    })

    it('dispatches to scoreMultipleChoice with choices', () => {
      const result = scoreDeterministic('multiple_choice', 'The answer is C', 'C', undefined, ['opt1', 'opt2', 'opt3'])
      expect(result).not.toBeNull()
      expect(result!.total).toBe(8)
    })

    it('returns null for unknown scorer', () => {
      const result = scoreDeterministic('llm', 'text')
      expect(result).toBeNull()
    })
  })
})
