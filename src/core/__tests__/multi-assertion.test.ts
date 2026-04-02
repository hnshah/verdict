import { describe, it, expect } from 'vitest'
import { scoreAssertion, aggregateScores } from '../runner.js'
import type { JudgeScore } from '../../types/index.js'

describe('multi-assertion support', () => {
  describe('scoreAssertion', () => {
    it('scores a contains assertion', () => {
      const result = scoreAssertion({ scorer: 'contains', expected: 'Paris' }, 'The city is Paris')
      expect(result).not.toBeNull()
      expect(result!.total).toBe(10)
    })

    it('fails a contains assertion when substring missing', () => {
      const result = scoreAssertion({ scorer: 'contains', expected: 'Berlin' }, 'The city is Paris')
      expect(result).not.toBeNull()
      expect(result!.total).toBe(0)
    })

    it('scores a json assertion', () => {
      const result = scoreAssertion({ scorer: 'json' }, '{"key": "value"}')
      expect(result).not.toBeNull()
      expect(result!.total).toBe(10)
    })

    it('scores an exact assertion', () => {
      const result = scoreAssertion({ scorer: 'exact', expected: 'Au' }, 'Au')
      expect(result).not.toBeNull()
      expect(result!.total).toBe(10)
    })

    it('scores a regex assertion', () => {
      const result = scoreAssertion({ scorer: 'regex', expected: '\\d+' }, 'answer is 42')
      expect(result).not.toBeNull()
      expect(result!.total).toBe(10)
    })

    it('scores a jsonschema assertion', () => {
      const schema = { required: ['name'], properties: { name: { type: 'string' } } }
      const result = scoreAssertion({ scorer: 'jsonschema', schema }, '{"name": "John"}')
      expect(result).not.toBeNull()
      expect(result!.total).toBe(10)
    })

    it('returns null for llm scorer (unsupported in assertions)', () => {
      const result = scoreAssertion({ scorer: 'llm' }, 'some text')
      expect(result).toBeNull()
    })
  })

  describe('aggregateScores', () => {
    it('returns zero score for empty array', () => {
      const result = aggregateScores([])
      expect(result.total).toBe(0)
      expect(result.reasoning).toBe('No assertions scored.')
    })

    it('returns the single score for one-element array', () => {
      const score: JudgeScore = { accuracy: 10, completeness: 10, conciseness: 10, total: 10, reasoning: 'Pass' }
      const result = aggregateScores([score])
      expect(result.total).toBe(10)
      expect(result.reasoning).toBe('[1] Pass')
    })

    it('uses minimum score when all pass', () => {
      const scores: JudgeScore[] = [
        { accuracy: 10, completeness: 10, conciseness: 10, total: 10, reasoning: 'A passes' },
        { accuracy: 10, completeness: 10, conciseness: 10, total: 10, reasoning: 'B passes' },
      ]
      const result = aggregateScores(scores)
      expect(result.total).toBe(10)
    })

    it('uses minimum score when one fails', () => {
      const scores: JudgeScore[] = [
        { accuracy: 10, completeness: 10, conciseness: 10, total: 10, reasoning: 'A passes' },
        { accuracy: 0, completeness: 0, conciseness: 0, total: 0, reasoning: 'B fails' },
      ]
      const result = aggregateScores(scores)
      expect(result.total).toBe(0)
      expect(result.accuracy).toBe(0)
    })

    it('merges reasoning strings with numbered prefixes', () => {
      const scores: JudgeScore[] = [
        { accuracy: 10, completeness: 10, conciseness: 10, total: 10, reasoning: 'First' },
        { accuracy: 10, completeness: 10, conciseness: 10, total: 10, reasoning: 'Second' },
      ]
      const result = aggregateScores(scores)
      expect(result.reasoning).toBe('[1] First | [2] Second')
    })

    it('picks minimum across individual fields', () => {
      const scores: JudgeScore[] = [
        { accuracy: 8, completeness: 10, conciseness: 6, total: 8, reasoning: 'Partial' },
        { accuracy: 10, completeness: 4, conciseness: 10, total: 7, reasoning: 'Also partial' },
      ]
      const result = aggregateScores(scores)
      expect(result.accuracy).toBe(8)
      expect(result.completeness).toBe(4)
      expect(result.conciseness).toBe(6)
      expect(result.total).toBe(7)
    })
  })

  describe('end-to-end multi-assertion', () => {
    it('all assertions pass → score 10', () => {
      const output = '{"city": "Paris"}'
      const assertions = [
        { scorer: 'json' as const },
        { scorer: 'contains' as const, expected: 'Paris' },
      ]
      const scores = assertions.map(a => scoreAssertion(a, output)).filter((s): s is JudgeScore => s !== null)
      const result = aggregateScores(scores)
      expect(result.total).toBe(10)
    })

    it('one assertion fails → score 0', () => {
      const output = '{"city": "Paris"}'
      const assertions = [
        { scorer: 'json' as const },
        { scorer: 'contains' as const, expected: 'Berlin' },
      ]
      const scores = assertions.map(a => scoreAssertion(a, output)).filter((s): s is JudgeScore => s !== null)
      const result = aggregateScores(scores)
      expect(result.total).toBe(0)
    })

    it('valid JSON but fails schema → partial score', () => {
      const output = '{"name": "John"}'
      const assertions = [
        { scorer: 'json' as const },
        { scorer: 'jsonschema' as const, schema: { required: ['name', 'age'], properties: { name: { type: 'string' }, age: { type: 'number' } } } },
      ]
      const scores = assertions.map(a => scoreAssertion(a, output)).filter((s): s is JudgeScore => s !== null)
      const result = aggregateScores(scores)
      // JSON passes (10), schema missing 'age' (10-2=8) → min is 8
      expect(result.total).toBe(8)
    })
  })

  describe('aggregateScores modes', () => {
    const scores: JudgeScore[] = [
      { accuracy: 10, completeness: 10, conciseness: 10, total: 10, reasoning: 'a' },
      { accuracy: 0, completeness: 0, conciseness: 0, total: 0, reasoning: 'b' },
    ]

    it('min takes minimum', () => expect(aggregateScores(scores, 'min').total).toBe(0))
    it('max takes maximum', () => expect(aggregateScores(scores, 'max').total).toBe(10))
    it('avg takes mean', () => expect(aggregateScores(scores, 'avg').total).toBe(5))
    it('weighted respects weights', () => {
      expect(aggregateScores(scores, 'weighted', [3, 1]).total).toBe(7.5)
    })
    it('weighted with equal weights behaves like avg', () => {
      expect(aggregateScores(scores, 'weighted', [1, 1]).total).toBe(5)
    })
    it('max returns 10 when both pass', () => {
      const both: JudgeScore[] = [
        { accuracy: 8, completeness: 8, conciseness: 8, total: 8, reasoning: 'x' },
        { accuracy: 6, completeness: 6, conciseness: 6, total: 6, reasoning: 'y' },
      ]
      expect(aggregateScores(both, 'max').total).toBe(8)
    })
    it('avg computes correct mean for multiple scores', () => {
      const three: JudgeScore[] = [
        { accuracy: 10, completeness: 10, conciseness: 10, total: 10, reasoning: 'a' },
        { accuracy: 4, completeness: 4, conciseness: 4, total: 4, reasoning: 'b' },
        { accuracy: 7, completeness: 7, conciseness: 7, total: 7, reasoning: 'c' },
      ]
      expect(aggregateScores(three, 'avg').total).toBe(7)
    })
  })
})
