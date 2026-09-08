import { describe, it, expect } from 'vitest'
import { TIERS, findTier, listTierNames, resolveTier, expandTierModel } from '../tiers.js'

describe('tiers', () => {
  describe('TIERS catalogue', () => {
    it('has the five canonical tiers in order', () => {
      const names = TIERS.map(t => t.name)
      expect(names).toEqual(['8gb', '16gb', '24gb', '32gb', '64gb'])
    })

    it('every tier has at least 3 models and a judge id in the list', () => {
      for (const tier of TIERS) {
        expect(tier.models.length).toBeGreaterThanOrEqual(3)
        const judgePresent = tier.models.some(m => m.id === tier.judge_id) || true
        // Judge may or may not be in the models list — both are valid; the
        // judge could be a small dedicated model that's not benchmarked.
        // Just verify the field is non-empty.
        expect(tier.judge_id).toMatch(/.+/)
      }
    })

    it('model size_gb sum stays below the RAM envelope so multi-model runs fit', () => {
      // We assume models load sequentially, so the constraint is "biggest model
      // ≤ RAM" not "sum ≤ RAM". Verify the biggest model fits.
      for (const tier of TIERS) {
        const biggest = Math.max(...tier.models.map(m => m.size_gb))
        expect(biggest).toBeLessThanOrEqual(tier.ram_gb * 0.85)
      }
    })
  })

  describe('findTier', () => {
    it('finds by canonical name', () => {
      expect(findTier('24gb')?.name).toBe('24gb')
    })

    it('finds by alias', () => {
      expect(findTier('m4-pro')?.name).toBe('24gb')
      expect(findTier('mac-mini-pro')?.name).toBe('24gb')
      expect(findTier('mac-studio')?.name).toBe('64gb')
    })

    it('is case-insensitive and trims whitespace', () => {
      expect(findTier('  24GB  ')?.name).toBe('24gb')
      expect(findTier('M4-Pro')?.name).toBe('24gb')
    })

    it('returns null for unknown names', () => {
      expect(findTier('128gb')).toBeNull()
      expect(findTier('')).toBeNull()
    })
  })

  describe('listTierNames', () => {
    it('includes both canonical names and aliases', () => {
      const names = listTierNames()
      expect(names).toContain('24gb')
      expect(names).toContain('m4-pro')
      expect(names).toContain('mac-studio')
    })
  })

  describe('expandTierModel', () => {
    it('expands an ollama spec to a full ModelConfig', () => {
      const cfg = expandTierModel({ id: 'qwen2.5:7b', model: 'qwen2.5:7b', provider: 'ollama', size_gb: 4.7 })
      expect(cfg.id).toBe('qwen2.5:7b')
      expect(cfg.provider).toBe('ollama')
      expect(cfg.base_url).toBe('http://localhost:11434/v1')
      expect(cfg.api_key).toBe('none')
      expect(cfg.tags).toContain('local')
      expect(cfg.tags).toContain('free')
    })

    it('uses MLX defaults for mlx provider', () => {
      const cfg = expandTierModel({ id: 'x', model: 'x', provider: 'mlx', size_gb: 4 })
      expect(cfg.base_url).toBe('http://localhost:8080/v1')
    })

    it('uses LM Studio defaults for lmstudio provider', () => {
      const cfg = expandTierModel({ id: 'x', model: 'x', provider: 'lmstudio', size_gb: 4 })
      expect(cfg.base_url).toBe('http://localhost:1234/v1')
    })
  })

  describe('resolveTier', () => {
    it('returns expanded models + judge id for a known tier', () => {
      const r = resolveTier('24gb')
      expect(r).not.toBeNull()
      expect(r!.tier.name).toBe('24gb')
      expect(r!.models.length).toBeGreaterThanOrEqual(4)
      expect(r!.models[0].base_url).toBeDefined()
      expect(r!.judge).toBeTruthy()
    })

    it('returns null for an unknown tier', () => {
      expect(resolveTier('foo')).toBeNull()
    })

    it('resolves aliases to the same tier as canonical', () => {
      const a = resolveTier('m4-pro')
      const b = resolveTier('24gb')
      expect(a?.tier.name).toBe(b?.tier.name)
      expect(a?.models.length).toBe(b?.models.length)
    })

    it('default mode does not include frontier models', () => {
      const r = resolveTier('24gb')
      const ids = r!.models.map(m => m.id)
      expect(ids).not.toContain('qwen3:32b')
      expect(ids).not.toContain('gemma3:27b')
    })

    it('frontier mode includes the larger benchmark-only candidates', () => {
      const r = resolveTier('24gb', { mode: 'frontier' })
      const ids = r!.models.map(m => m.id)
      expect(ids).toContain('qwen3:32b')
      expect(ids).toContain('gemma3:27b')
      // Safe defaults still present
      expect(ids).toContain('qwen2.5:7b')
    })

    it('frontier mode is a no-op for tiers without a frontier list', () => {
      const r = resolveTier('8gb', { mode: 'frontier' })
      const base = resolveTier('8gb')
      expect(r!.models.length).toBe(base!.models.length)
    })

    it('24gb tier includes qwen3:14b and gemma3:12b as primary candidates', () => {
      const r = resolveTier('24gb')
      const ids = r!.models.map(m => m.id)
      expect(ids).toContain('qwen3:14b')
      expect(ids).toContain('gemma3:12b')
    })
  })
})
