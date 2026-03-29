import { describe, it, expect } from 'vitest'
import { TaskClassifier } from '../classifier.js'

describe('TaskClassifier', () => {
  const classifier = new TaskClassifier()

  // --- Writing ---

  it('classifies "write me a poem" as writing', () => {
    const result = classifier.classify('write me a poem')
    expect(result.category).toBe('writing')
  })

  it('classifies "write a blog post about AI" as writing', () => {
    const result = classifier.classify('write a blog post about AI')
    expect(result.category).toBe('writing')
  })

  it('classifies "compose an essay on climate change" as writing', () => {
    const result = classifier.classify('compose an essay on climate change')
    expect(result.category).toBe('writing')
  })

  // --- Bug analysis ---

  it('classifies "debug this code" as bug_analysis', () => {
    const result = classifier.classify('debug this code')
    expect(result.category).toBe('bug_analysis')
  })

  it('classifies "fix the error in my app" as bug_analysis', () => {
    const result = classifier.classify('fix the error in my app')
    expect(result.category).toBe('bug_analysis')
  })

  it('classifies "there is a crash when I click submit" as bug_analysis', () => {
    const result = classifier.classify('there is a crash when I click submit')
    expect(result.category).toBe('bug_analysis')
  })

  // --- Code generation ---

  it('classifies "write a typescript function to sort an array" as code_generation', () => {
    const result = classifier.classify('write a typescript function to sort an array')
    expect(result.category).toBe('code_generation')
  })

  it('classifies "implement a binary search function in python" as code_generation', () => {
    const result = classifier.classify('implement a binary search function in python')
    expect(result.category).toBe('code_generation')
  })

  it('classifies prompt with code block as code_generation', () => {
    const result = classifier.classify('```\nconst x = 5;\nconsole.log(x);\n```')
    expect(result.category).toBe('code_generation')
  })

  it('classifies "create a class for user authentication" as code_generation', () => {
    const result = classifier.classify('create a class for user authentication')
    expect(result.category).toBe('code_generation')
  })

  // --- Code review ---

  it('classifies "review this code and refactor" as code_review', () => {
    const result = classifier.classify('review this code and refactor it')
    expect(result.category).toBe('code_review')
  })

  it('classifies "audit this module" as code_review', () => {
    const result = classifier.classify('audit this module for issues')
    expect(result.category).toBe('code_review')
  })

  // --- Math ---

  it('classifies "what is 2 + 2" as math', () => {
    const result = classifier.classify('what is 2 + 2')
    expect(result.category).toBe('math')
  })

  // --- Reasoning ---

  it('classifies "why does the sky appear blue" as reasoning', () => {
    const result = classifier.classify('why does the sky appear blue')
    expect(result.category).toBe('reasoning')
  })

  it('classifies "how does photosynthesis work" as reasoning', () => {
    const result = classifier.classify('how does photosynthesis work')
    expect(result.category).toBe('reasoning')
  })

  // --- Manual override ---

  it('returns manual category when provided', () => {
    const result = classifier.classify('anything', 'math')
    expect(result.category).toBe('math')
    expect(result.confidence).toBe(1.0)
    expect(result.method).toBe('manual')
  })

  // --- Classification structure ---

  it('returns proper Classification shape', () => {
    const result = classifier.classify('write me a haiku')
    expect(result).toHaveProperty('category')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('signals')
    expect(result).toHaveProperty('method')
    expect(typeof result.confidence).toBe('number')
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(Array.isArray(result.signals)).toBe(true)
    expect(result.method).toBe('auto')
  })

  it('auto-classified prompts have confidence between 0 and 1', () => {
    const prompts = ['hello', 'fix the bug', 'write code', '2+2', 'explain gravity']
    for (const p of prompts) {
      const result = classifier.classify(p)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    }
  })
})
