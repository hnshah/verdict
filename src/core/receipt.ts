/**
 * Reproducibility receipts.
 *
 * After a successful run, verdict writes a `receipt.json` next to the result
 * JSON. The receipt is a small, hashable bundle that captures everything
 * needed to verify or reproduce a run:
 *   - which models (id + provider + model name + base_url + cost rates)
 *   - which judge (model + rubric)
 *   - which dataset (hash of all eval-pack case prompts + criteria)
 *   - hardware (platform + arch + node + CPU + RAM)
 *   - verdict version
 *   - the exact `verdict run …` command that produced this result
 *
 * Receipts are intentionally additive — no other code paths depend on them,
 * and an unwritable output dir is logged as a warning rather than failing
 * the run.
 */

import crypto from 'crypto'
import os from 'os'
import type { Config, EvalPack } from '../types/index.js'

export const RECEIPT_VERSION = 1 as const

export interface ReproReceipt {
  receipt_version: typeof RECEIPT_VERSION
  generated_at: string                                       // ISO-8601
  verdict_version: string
  run_id: string
  hashes: {
    config: string                                           // models + judge + packs
    dataset: string                                          // all pack cases (prompt + criteria + scorer + expected)
    judge: string                                            // judge model + rubric
    models: Record<string, string>                           // per-model: provider+model+base_url+cost
  }
  models: Array<{
    id: string
    model: string
    provider?: string
    base_url?: string
    cost_per_1m_input?: number
    cost_per_1m_output?: number
  }>
  judge: { model: string; rubric?: unknown }
  packs: string[]
  case_count: number
  hardware: {
    platform: NodeJS.Platform
    arch: string
    node_version: string
    cpu_count: number
    total_memory_gb: number
  }
  repro_command: string
}

/** Stable 12-char SHA-256 prefix. */
function shortHash(value: unknown): string {
  const json = JSON.stringify(value)
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 12)
}

function hashModel(m: Config['models'][number]): string {
  return shortHash({
    provider: m.provider,
    model: m.model,
    base_url: m.base_url,
    cost_per_1m_input: m.cost_per_1m_input,
    cost_per_1m_output: m.cost_per_1m_output,
  })
}

function hashDataset(packs: EvalPack[]): string {
  // Sort cases by id within each pack so output is stable regardless of
  // case ordering. Include the bits that affect *what* is measured.
  const slim = packs.map(p => ({
    name: p.name,
    cases: [...p.cases]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(c => ({
        id: c.id,
        prompt: c.prompt,
        criteria: c.criteria,
        scorer: c.scorer,
        expected: c.expected,
      })),
  }))
  return shortHash(slim)
}

function hashJudge(judge: Config['judge']): string {
  return shortHash({
    model: judge.model,
    rubric: judge.rubric,
    strategy: judge.strategy,
  })
}

export function buildReproCommand(
  configPath: string,
  options: { pack?: string; models?: string; tier?: string; category?: string[] }
): string {
  const parts = ['verdict', 'run', '-c', configPath]
  if (options.pack) parts.push('--pack', options.pack)
  if (options.tier) parts.push('--tier', options.tier)
  if (options.models) parts.push('--models', `"${options.models}"`)
  if (options.category && options.category.length > 0) {
    parts.push('--category', options.category.join(' '))
  }
  return parts.join(' ')
}

export function computeReceipt(args: {
  config: Config
  packs: EvalPack[]
  runId: string
  verdictVersion: string
  reproCommand: string
}): ReproReceipt {
  const { config, packs, runId, verdictVersion, reproCommand } = args

  const totalMemoryGb = +(os.totalmem() / 1e9).toFixed(1)
  const modelHashes: Record<string, string> = {}
  for (const m of config.models) modelHashes[m.id] = hashModel(m)

  const configHash = shortHash({
    models: config.models.map(m => ({ id: m.id, h: modelHashes[m.id] })),
    judge: hashJudge(config.judge),
    packs: config.packs,
  })

  return {
    receipt_version: RECEIPT_VERSION,
    generated_at: new Date().toISOString(),
    verdict_version: verdictVersion,
    run_id: runId,
    hashes: {
      config: configHash,
      dataset: hashDataset(packs),
      judge: hashJudge(config.judge),
      models: modelHashes,
    },
    models: config.models.map(m => ({
      id: m.id,
      model: m.model,
      provider: m.provider,
      base_url: m.base_url,
      cost_per_1m_input: m.cost_per_1m_input,
      cost_per_1m_output: m.cost_per_1m_output,
    })),
    judge: { model: config.judge.model, rubric: config.judge.rubric },
    packs: config.packs,
    case_count: packs.reduce((s, p) => s + p.cases.length, 0),
    hardware: {
      platform: process.platform,
      arch: process.arch,
      node_version: process.version,
      cpu_count: os.cpus().length,
      total_memory_gb: totalMemoryGb,
    },
    repro_command: reproCommand,
  }
}
