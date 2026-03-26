import { describe, it, expect } from 'vitest'
import { sparkline } from '../history.js'
import { parseSince } from '../../../db/client.js'

describe('history command', () => {
  describe('sparkline', () => {
    it('generates sparkline from scores', () => {
      const result = sparkline([1, 5, 10])
      expect(result.length).toBe(3)
      // First char should be lowest, last should be highest
      expect(result[0]).toBe('▁')
      expect(result[2]).toBe('█')
    })

    it('handles empty array', () => {
      expect(sparkline([])).toBe('')
    })

    it('handles all same values', () => {
      const result = sparkline([5, 5, 5])
      expect(result.length).toBe(3)
      // All same values should produce same character
      expect(result[0]).toBe(result[1])
      expect(result[1]).toBe(result[2])
    })

    it('handles single value', () => {
      const result = sparkline([7])
      expect(result.length).toBe(1)
    })

    it('uses correct unicode block characters', () => {
      const chars = '▁▂▃▄▅▆▇█'
      const result = sparkline([0, 1, 2, 3, 4, 5, 6, 7, 8])
      // Should use full range of characters
      for (const char of result) {
        expect(chars).toContain(char)
      }
    })

    it('correctly orders ascending scores', () => {
      const result = sparkline([2, 4, 6, 8, 10])
      // Each subsequent character should be >= previous in the block char ordering
      const chars = '▁▂▃▄▅▆▇█'
      for (let i = 1; i < result.length; i++) {
        expect(chars.indexOf(result[i])).toBeGreaterThanOrEqual(chars.indexOf(result[i - 1]))
      }
    })

    it('correctly orders descending scores', () => {
      const result = sparkline([10, 8, 6, 4, 2])
      const chars = '▁▂▃▄▅▆▇█'
      for (let i = 1; i < result.length; i++) {
        expect(chars.indexOf(result[i])).toBeLessThanOrEqual(chars.indexOf(result[i - 1]))
      }
    })
  })

  describe('parseSince', () => {
    it('parses "7d" into approximately 7 days ago', () => {
      const result = parseSince('7d')
      expect(result).not.toBeNull()
      const now = new Date()
      const diffDays = (now.getTime() - result!.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(6.9)
      expect(diffDays).toBeLessThan(7.1)
    })

    it('parses "24h" into approximately 24 hours ago', () => {
      const result = parseSince('24h')
      expect(result).not.toBeNull()
      const now = new Date()
      const diffHours = (now.getTime() - result!.getTime()) / (1000 * 60 * 60)
      expect(diffHours).toBeGreaterThan(23.9)
      expect(diffHours).toBeLessThan(24.1)
    })

    it('parses "1w" into approximately 7 days ago', () => {
      const result = parseSince('1w')
      expect(result).not.toBeNull()
      const now = new Date()
      const diffDays = (now.getTime() - result!.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(6.9)
      expect(diffDays).toBeLessThan(7.1)
    })

    it('parses "30d" into approximately 30 days ago', () => {
      const result = parseSince('30d')
      expect(result).not.toBeNull()
      const now = new Date()
      const diffDays = (now.getTime() - result!.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(29.9)
      expect(diffDays).toBeLessThan(30.1)
    })

    it('returns null for invalid formats', () => {
      expect(parseSince('abc')).toBeNull()
      expect(parseSince('7m')).toBeNull()
      expect(parseSince('')).toBeNull()
      expect(parseSince('d7')).toBeNull()
    })
  })
})
