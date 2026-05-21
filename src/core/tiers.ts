/**
 * Hardware-tier model presets.
 *
 * Removes the "which models do I even pick?" cold-start cognitive load by
 * mapping a RAM envelope to a curated set of ~4-6 models that fit. Used by
 * `verdict run --tier <name>` and the `verdict tiers` command.
 *
 * Models are listed in priority order (most-recommended first). The judge
 * is whichever model is fastest + good-enough at that tier — usually the
 * smallest 7B in the list.
 */

import type { ModelConfig } from '../types/index.js'

export interface TierModelSpec {
  id: string                                   // verdict id
  model: string                                // provider's model name
  provider: 'ollama' | 'mlx' | 'lmstudio'
  size_gb: number                              // expected on-disk size at default quant
  notes?: string
}

export interface Tier {
  name: string                                 // canonical name (e.g. '24gb')
  description: string
  ram_gb: number                               // approximate RAM envelope
  judge_id: string                             // which model in `models` should be the judge
  models: TierModelSpec[]
  aliases?: string[]                           // alternate names (e.g. 'm4-pro', 'mac-mini')
}

const OLLAMA_BASE = 'http://localhost:11434/v1'

/**
 * Tier definitions. Sizes are approximate q4 quants from the Ollama library
 * (the most common default). Models are kept generic — these are starting
 * points; users edit verdict.yaml after.
 */
export const TIERS: Tier[] = [
  {
    name: '8gb',
    description: 'Mac mini (base) · older laptops · Raspberry Pi 5',
    ram_gb: 8,
    judge_id: 'phi3.5',
    aliases: ['mac-mini-base', 'pi5'],
    models: [
      { id: 'phi3.5',           model: 'phi3.5',           provider: 'ollama', size_gb: 2.2, notes: 'fastest 3B' },
      { id: 'llama3.2:3b',      model: 'llama3.2:3b',      provider: 'ollama', size_gb: 2.0 },
      { id: 'qwen2.5:3b',       model: 'qwen2.5:3b',       provider: 'ollama', size_gb: 1.9 },
      { id: 'qwen2.5-coder:3b', model: 'qwen2.5-coder:3b', provider: 'ollama', size_gb: 1.9, notes: 'code' },
    ],
  },
  {
    name: '16gb',
    description: 'MacBook Air · most laptops · cloud VMs',
    ram_gb: 16,
    judge_id: 'qwen2.5:7b',
    aliases: ['macbook-air', 'm-series-base'],
    models: [
      { id: 'qwen2.5:7b',       model: 'qwen2.5:7b',       provider: 'ollama', size_gb: 4.7, notes: 'strong general 7B' },
      { id: 'qwen2.5-coder:7b', model: 'qwen2.5-coder:7b', provider: 'ollama', size_gb: 4.7, notes: 'code specialist' },
      { id: 'llama3.1:8b',      model: 'llama3.1:8b',      provider: 'ollama', size_gb: 4.9, notes: 'popular baseline' },
      { id: 'phi3.5',           model: 'phi3.5',           provider: 'ollama', size_gb: 2.2, notes: 'tiny fast tier' },
    ],
  },
  {
    name: '24gb',
    description: 'Mac mini M4 Pro · MacBook Pro M3 · mid-tier laptops',
    ram_gb: 24,
    judge_id: 'qwen2.5:7b',
    aliases: ['mac-mini-pro', 'm4-pro', 'macbook-pro-m3'],
    models: [
      { id: 'qwen2.5:7b',       model: 'qwen2.5:7b',       provider: 'ollama', size_gb: 4.7 },
      { id: 'qwen2.5-coder:7b', model: 'qwen2.5-coder:7b', provider: 'ollama', size_gb: 4.7, notes: 'code' },
      { id: 'llama3.1:8b',      model: 'llama3.1:8b',      provider: 'ollama', size_gb: 4.9 },
      { id: 'qwen2.5:14b',      model: 'qwen2.5:14b',      provider: 'ollama', size_gb: 9.0, notes: 'frontier of the tier' },
      { id: 'phi3.5',           model: 'phi3.5',           provider: 'ollama', size_gb: 2.2 },
    ],
  },
  {
    name: '32gb',
    description: 'MacBook Pro · high-end laptops · workstations',
    ram_gb: 32,
    judge_id: 'qwen2.5:7b',
    aliases: ['macbook-pro', 'm-series-pro'],
    models: [
      { id: 'qwen2.5:14b',       model: 'qwen2.5:14b',       provider: 'ollama', size_gb: 9.0 },
      { id: 'qwen2.5-coder:14b', model: 'qwen2.5-coder:14b', provider: 'ollama', size_gb: 9.0, notes: 'code' },
      { id: 'llama3.1:8b',       model: 'llama3.1:8b',       provider: 'ollama', size_gb: 4.9 },
      { id: 'qwen2.5:7b',        model: 'qwen2.5:7b',        provider: 'ollama', size_gb: 4.7, notes: 'judge' },
      { id: 'qwen2.5:32b',       model: 'qwen2.5:32b',       provider: 'ollama', size_gb: 19, notes: 'frontier — tight on 32GB' },
    ],
  },
  {
    name: '64gb',
    description: 'Mac Studio · M-series Max · servers',
    ram_gb: 64,
    judge_id: 'qwen2.5:7b',
    aliases: ['mac-studio', 'm-series-max', '64gb+'],
    models: [
      { id: 'qwen2.5:32b',       model: 'qwen2.5:32b',       provider: 'ollama', size_gb: 19 },
      { id: 'qwen2.5-coder:32b', model: 'qwen2.5-coder:32b', provider: 'ollama', size_gb: 19, notes: 'code' },
      { id: 'llama3.1:70b',      model: 'llama3.1:70b',      provider: 'ollama', size_gb: 40, notes: 'frontier' },
      { id: 'qwen2.5:14b',       model: 'qwen2.5:14b',       provider: 'ollama', size_gb: 9.0 },
      { id: 'qwen2.5:7b',        model: 'qwen2.5:7b',        provider: 'ollama', size_gb: 4.7, notes: 'judge' },
    ],
  },
]

/** Look up a tier by name or alias (case-insensitive). */
export function findTier(name: string): Tier | null {
  const n = name.toLowerCase().trim()
  for (const tier of TIERS) {
    if (tier.name === n) return tier
    if (tier.aliases?.some(a => a.toLowerCase() === n)) return tier
  }
  return null
}

/** All canonical tier names + aliases. */
export function listTierNames(): string[] {
  return TIERS.flatMap(t => [t.name, ...(t.aliases ?? [])])
}

/**
 * Expand a TierModelSpec into a full ModelConfig (with provider defaults).
 * Reuses the standard Ollama localhost endpoint when no explicit base_url is set.
 */
export function expandTierModel(spec: TierModelSpec): ModelConfig {
  const base_url = spec.provider === 'ollama' ? OLLAMA_BASE
                 : spec.provider === 'mlx' ? 'http://localhost:8080/v1'
                 : 'http://localhost:1234/v1' // lmstudio
  return {
    id: spec.id,
    model: spec.model,
    provider: spec.provider,
    base_url,
    api_key: 'none',
    port: 8080,
    tags: ['local', 'free'],
    timeout_ms: 120_000,
    max_tokens: 1024,
  }
}

/**
 * Resolve a tier name to a full model list + recommended judge model id.
 * Returns null if the tier is unknown.
 */
export function resolveTier(name: string): { tier: Tier; models: ModelConfig[]; judge: string } | null {
  const tier = findTier(name)
  if (!tier) return null
  const models = tier.models.map(expandTierModel)
  return { tier, models, judge: tier.judge_id }
}
