import { describe, it, expect } from 'vitest'
import { findTemplate, listTemplateNames, loadTemplate, TEMPLATES } from '../templates.js'

describe('templates', () => {
  it('catalogue contains rag / agent / support', () => {
    const names = TEMPLATES.map(t => t.name)
    expect(names).toEqual(['rag', 'agent', 'support'])
  })

  it('findTemplate is case-insensitive and trims whitespace', () => {
    expect(findTemplate('rag')?.name).toBe('rag')
    expect(findTemplate('RAG')?.name).toBe('rag')
    expect(findTemplate('  Agent  ')?.name).toBe('agent')
  })

  it('returns null for unknown templates', () => {
    expect(findTemplate('foo')).toBeNull()
    expect(findTemplate('')).toBeNull()
  })

  it('listTemplateNames returns the canonical name set', () => {
    expect(listTemplateNames()).toEqual(['rag', 'agent', 'support'])
  })

  it('loadTemplate returns yaml strings for verdict.yaml + eval-pack.yaml', () => {
    for (const t of TEMPLATES) {
      const files = loadTemplate(t.name)
      // verdict.yaml has the expected `models:` and `judge:` keys
      expect(files.verdictYaml).toContain('models:')
      expect(files.verdictYaml).toContain('judge:')
      // The eval pack has cases
      expect(files.evalPackYaml).toContain('cases:')
      // Sanity: nontrivial bodies (avoid empty files slipping through)
      expect(files.verdictYaml.length).toBeGreaterThan(200)
      expect(files.evalPackYaml.length).toBeGreaterThan(500)
    }
  })

  it('loadTemplate throws on unknown template name', () => {
    expect(() => loadTemplate('does-not-exist')).toThrow(/Unknown template/)
  })
})
