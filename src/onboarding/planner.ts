/**
 * Pure planner: given a Snapshot, decide what the onboarding flow should
 * do. No I/O, fully deterministic, fully testable.
 *
 * Selection priority:
 *   1. config-only — valid existing verdict.yaml + ≥1 working model.
 *   2. cloud-only  — cloud key, no useful local runtime.
 *   3. reuse-local — Ollama is up + has installed models.
 *   4. local-first — install Ollama if needed, pull 2-3 models.
 */

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { z } from 'zod'

import { checkFit, estimateRamGB } from '../core/hardware.js'
import type { HardwareInfo } from '../core/hardware.js'
import { idFromModelName } from './templates.js'
import type {
  HardwareSnapshot,
  InstallStep,
  Plan,
  PlannedCloudModel,
  PlannedModel,
  Snapshot,
} from './events.js'

// ─── Catalog loading ────────────────────────────────────────────────────────

const CatalogModelSchema = z.object({
  name: z.string(),
  provider: z.enum(['ollama', 'mlx']),
  params_b: z.number().positive(),
  default_quant: z.string(),
  family: z.string().optional(),
  tags: z.array(z.string()).default([]),
})
const ModelCatalogSchema = z.object({
  version: z.string(),
  models: z.array(CatalogModelSchema).default([]),
})
export type CatalogModel = z.infer<typeof CatalogModelSchema>

const DEFAULT_CATALOG_PATH = './configs/model-catalog.yaml'

export function loadModelCatalog(catalogPath = DEFAULT_CATALOG_PATH): CatalogModel[] {
  const full = path.resolve(catalogPath)
  if (!fs.existsSync(full)) {
    throw new Error(`Model catalog not found: ${full}`)
  }
  const raw = yaml.load(fs.readFileSync(full, 'utf8'))
  const parsed = ModelCatalogSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid model catalog:\n${issues}`)
  }
  return parsed.data.models
}

// ─── Default cloud judge model ──────────────────────────────────────────────

const CLOUD_FAST_MINI: PlannedCloudModel = {
  id: 'cloud-mini',
  base_url: 'https://openrouter.ai/api/v1',
  apiKeyEnv: 'OPENROUTER_API_KEY',
  model: 'anthropic/claude-haiku-3-5',
  costPer1mInput: 0.8,
  costPer1mOutput: 4.0,
}

const CLOUD_QUALITY_MID: PlannedCloudModel = {
  id: 'cloud-mid',
  base_url: 'https://openrouter.ai/api/v1',
  apiKeyEnv: 'OPENROUTER_API_KEY',
  model: 'anthropic/claude-sonnet-4-5',
  costPer1mInput: 3.0,
  costPer1mOutput: 15.0,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toHardwareInfo(h: HardwareSnapshot): HardwareInfo {
  return {
    cpu: h.cpu,
    cpuCores: h.cpuCores,
    cpuArch: h.cpuArch,
    ram: h.ram,
    ramGB: h.ramGB,
    freeDiskGB: h.freeDiskGB,
    os: h.os,
    osVersion: h.osVersion,
    gpu: h.gpu,
  }
}

function familyOf(name: string): string {
  if (name.includes('llama')) return 'llama'
  if (name.includes('qwen')) return 'qwen'
  if (name.includes('mistral')) return 'mistral'
  if (name.includes('deepseek')) return 'deepseek'
  if (name.includes('phi')) return 'phi'
  if (name.includes('gemma')) return 'gemma'
  if (name.includes('codellama')) return 'llama'
  if (name.includes('codestral')) return 'mistral'
  return 'other'
}

function findCatalog(
  catalog: CatalogModel[],
  name: string
): CatalogModel | undefined {
  return catalog.find(c => c.name === name)
}

function toPlannedModel(
  c: CatalogModel,
  role: PlannedModel['role']
): PlannedModel {
  // Same overhead approximation as estimateRamGB but without the 1.2 KV-cache
  // multiplier, for the wire-byte estimate.
  const sizeGB = +(estimateRamGB(c.params_b, c.default_quant) / 1.2).toFixed(1)
  return {
    name: c.name,
    provider: 'ollama',
    role,
    paramsB: c.params_b,
    defaultQuant: c.default_quant,
    estimatedSizeGB: sizeGB,
  }
}

function pickFirstFitting(
  catalog: CatalogModel[],
  candidates: string[],
  hardware: HardwareInfo,
  exclude: Set<string>
): CatalogModel | undefined {
  for (const name of candidates) {
    if (exclude.has(name)) continue
    const entry = findCatalog(catalog, name)
    if (!entry) continue
    const fit = checkFit(
      { name: entry.name, params_b: entry.params_b, quant: entry.default_quant },
      hardware
    )
    if (fit.fits) return entry
  }
  return undefined
}

function estimatePullMinutes(model: PlannedModel, online: boolean): [number, number] {
  if (!online) return [0, 0]
  // Rough heuristic: 50 Mbps optimistic (~6 MB/s), 10 Mbps pessimistic (~1.2 MB/s).
  // sizeGB * 1024 MB / MB-per-sec / 60
  const optimisticSec = (model.estimatedSizeGB * 1024) / 6
  const pessimisticSec = (model.estimatedSizeGB * 1024) / 1.2
  return [optimisticSec / 60, pessimisticSec / 60]
}

// ─── The planner ────────────────────────────────────────────────────────────

export interface PlannerOptions {
  catalogPath?: string
  /** Inject a pre-loaded catalog (useful for tests). */
  catalog?: CatalogModel[]
}

export function propose(snapshot: Snapshot, opts: PlannerOptions = {}): Plan {
  const catalog = opts.catalog ?? loadModelCatalog(opts.catalogPath)
  const hardware = toHardwareInfo(snapshot.hardware)
  const hasCloudKey =
    snapshot.cloud.openrouterKey ||
    snapshot.cloud.anthropicKey ||
    snapshot.cloud.openaiKey ||
    snapshot.cloud.groqKey

  // ── 1. Config-only ────────────────────────────────────────────────────────
  if (snapshot.config.exists && snapshot.config.valid && (snapshot.config.modelCount ?? 0) >= 1) {
    return {
      intent: 'config-only',
      installSteps: [],
      modelsToPull: [],
      cloudModels: [],
      reuseModels: snapshot.ollama.installedModels,
      judge: {
        modelId: 'existing',
        rationale: 'Using judge already configured in your verdict.yaml.',
      },
      config: { action: 'leave', targetPath: snapshot.config.path ?? './verdict.yaml' },
      rationale:
        'verdict.yaml already exists and looks valid — verifying the existing setup works end-to-end.',
      estimatedDownloadGB: 0,
      estimatedDurationMin: [0.5, 2],
    }
  }

  // ── 2. Cloud-only ─────────────────────────────────────────────────────────
  // Trigger when the user has a cloud key AND either (a) no Apple Silicon or
  // (b) no Ollama installed AND no Ollama models running. The user can always
  // override via the customize step.
  const noUsefulLocal =
    !snapshot.ollama.installed &&
    !snapshot.mlx.serverRunning &&
    !snapshot.lmstudio.serverRunning
  if (hasCloudKey && (noUsefulLocal || !snapshot.hardware.cpuArch.includes('arm'))) {
    const cloudModels: PlannedCloudModel[] = [CLOUD_FAST_MINI, CLOUD_QUALITY_MID]
    return {
      intent: 'cloud-only',
      installSteps: [],
      modelsToPull: [],
      cloudModels,
      reuseModels: [],
      judge: {
        modelId: CLOUD_FAST_MINI.id,
        rationale: 'Using a fast cloud model as judge — most consistent for first-run.',
      },
      config: {
        action: snapshot.config.exists ? 'merge' : 'create',
        targetPath: snapshot.config.path ?? './verdict.yaml',
      },
      rationale:
        'OPENROUTER_API_KEY detected and no local runtime found — using two cloud models so you can run an eval immediately.',
      estimatedDownloadGB: 0,
      estimatedDurationMin: [0.5, 2],
    }
  }

  // ── 3. Reuse local ────────────────────────────────────────────────────────
  if (snapshot.ollama.daemonRunning && snapshot.ollama.installedModels.length >= 1) {
    const reuse = snapshot.ollama.installedModels.slice(0, 3)
    // Judge id must match the `id:` we write to verdict.yaml — that's the
    // slugified form, not the raw `ollama list` name.
    const judgeId = hasCloudKey
      ? CLOUD_FAST_MINI.id
      : reuse[0] ? idFromModelName(reuse[0]) : ''
    return {
      intent: 'reuse-local',
      installSteps: [],
      modelsToPull: [],
      cloudModels: hasCloudKey ? [CLOUD_FAST_MINI] : [],
      reuseModels: reuse,
      judge: {
        modelId: judgeId,
        rationale: hasCloudKey
          ? 'Using cloud mini as judge (most consistent).'
          : 'Using your smallest local model as judge (note: local judging is noisier).',
      },
      config: {
        action: snapshot.config.exists ? 'merge' : 'create',
        targetPath: snapshot.config.path ?? './verdict.yaml',
      },
      rationale: `Ollama is already running with ${snapshot.ollama.installedModels.length} model(s) — using them so you can run an eval right away.`,
      estimatedDownloadGB: 0,
      estimatedDurationMin: [0.5, 2],
    }
  }

  // ── 4. Local-first ────────────────────────────────────────────────────────
  const installSteps: InstallStep[] = []
  if (!snapshot.ollama.installed) {
    installSteps.push({
      id: 'install-ollama',
      label: snapshot.homebrew.installed
        ? 'Install Ollama (brew install ollama)'
        : 'Install Ollama (curl install.sh)',
      required: true,
      method: snapshot.homebrew.installed ? 'brew' : 'curl',
      estimatedSeconds: 60,
    })
  }
  if (!snapshot.ollama.daemonRunning) {
    installSteps.push({
      id: 'start-ollama',
      label: 'Start the Ollama daemon',
      required: true,
      estimatedSeconds: 5,
    })
  }

  // Pair selection — tuned for the first-run experience (Theme B):
  //  - Small machines (<32 GB RAM): two 3Bs from different families. Cold-load
  //    is ~5-15s each, total time-to-first-token under a minute.
  //  - Larger machines (≥32 GB RAM): mid pick upgrades to 7B for capability
  //    diversity; coder model added at 7B for code tasks.
  //
  // The dogfood revealed qwen2.5:7b takes ~147s to cold-load even on M4 Pro,
  // which is the single worst moment of onboarding. Two 3Bs cover the
  // "compare local options" decision in a fraction of that time.
  const installed = new Set(snapshot.ollama.installedModels)
  const picked: PlannedModel[] = []
  const usedFamilies = new Set<string>()
  const wantsLargerModels = hardware.ramGB >= 32

  const smallCandidates = ['llama3.2:3b', 'qwen2.5:3b']
  const small = pickFirstFitting(catalog, smallCandidates, hardware, installed)
  if (small) {
    picked.push(toPlannedModel(small, 'general-small'))
    usedFamilies.add(familyOf(small.name))
  }

  // On smaller machines, prefer a second 3B from a different family over a
  // 7B — the diversity is what answers "which local model is good for me?"
  // and a 7B doubles cold-load time for marginal capability gain at 3B-task
  // resolution.
  const midCandidates = (wantsLargerModels
    ? ['qwen2.5:7b', 'llama3.1:8b', 'mistral:7b', 'gemma2:9b']
    : ['qwen2.5:3b', 'llama3.2:3b', 'mistral:7b']
  ).filter(n => !usedFamilies.has(familyOf(n)))
  const mid = pickFirstFitting(catalog, midCandidates, hardware, installed)
  if (mid) {
    picked.push(toPlannedModel(mid, wantsLargerModels ? 'general-mid' : 'general-small'))
    usedFamilies.add(familyOf(mid.name))
  }

  if (wantsLargerModels) {
    // Coder pick is only useful at 7B+ — smaller coder models score
    // similarly to general 3Bs on the canonical pack while adding load
    // time. Gate behind RAM ≥ 32 GB.
    const coderCandidates = ['qwen2.5-coder:7b', 'deepseek-coder:6.7b', 'codellama:7b']
    const coder = pickFirstFitting(catalog, coderCandidates, hardware, installed)
    if (coder) {
      picked.push(toPlannedModel(coder, 'coder'))
    }
  }

  // Judge: cloud if available, else smallest local model.
  const cloudModels: PlannedCloudModel[] = hasCloudKey ? [CLOUD_FAST_MINI] : []
  const smallestLocal = [...picked].sort((a, b) => a.paramsB - b.paramsB)[0]
  // Match the slug the YAML writer will use as the model's `id:` — never
  // the raw model name, which differs (e.g. "llama3.2:3b" vs "llama3-2-3b").
  const judgeModelId = hasCloudKey
    ? CLOUD_FAST_MINI.id
    : smallestLocal ? idFromModelName(smallestLocal.name) : ''
  const judgeRationale = hasCloudKey
    ? 'Using cloud mini as judge — cheapest and most consistent option.'
    : smallestLocal
      ? `Using your smallest local model (${smallestLocal.name}) as a self-judge — note this is noisier than a cloud judge.`
      : 'No judge selected yet — add OPENROUTER_API_KEY to use a cloud judge.'

  const estimatedDownloadGB = +picked
    .reduce((sum, m) => sum + m.estimatedSizeGB, 0)
    .toFixed(1)

  // Aggregate ETA assuming concurrency=2: take the worst-case for the longest
  // 2 pulls in parallel; this is rough but it's what we surface to the user.
  const eta = picked.reduce<[number, number]>(
    (acc, m) => {
      const [o, p] = estimatePullMinutes(m, snapshot.network.online)
      return [acc[0] + o / 2, acc[1] + p / 2]
    },
    [1, 2] // 1-2 min baseline for install + verify
  )

  return {
    intent: 'local-first',
    installSteps,
    modelsToPull: picked,
    cloudModels,
    reuseModels: [],
    judge: { modelId: judgeModelId, rationale: judgeRationale },
    config: {
      action: snapshot.config.exists ? 'replace-with-backup' : 'create',
      targetPath: snapshot.config.path ?? './verdict.yaml',
    },
    rationale:
      picked.length === 0
        ? 'No models fit this hardware — consider freeing RAM/disk or adding a cloud key.'
        : `Picked ${picked.length} model(s) sized to fit your ${snapshot.hardware.ramGB} GB of RAM. We'll install Ollama if needed, pull them in parallel, and run a smoke eval.`,
    estimatedDownloadGB,
    estimatedDurationMin: [+eta[0].toFixed(1), +eta[1].toFixed(1)],
  }
}
