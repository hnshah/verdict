import fs from 'fs'
import path from 'path'
import type { RunResult, BaselineComparison, BaselineDelta } from '../types/index.js'

const BASELINES_DIR = '.verdict-baselines'

/**
 * Sidecar metadata for a baseline. Stored alongside the result JSON as
 * `<name>.meta.json` so it can be queried/updated without touching the
 * (potentially large) result file. Backwards-compatible: a baseline
 * without a sidecar still loads cleanly.
 */
export interface BaselineMetadata {
  /** Human-readable description: "before claude-haiku-3.5 upgrade", etc. */
  description?: string
  /** ISO timestamp the baseline was saved. */
  savedAt: string
}

function baselinesDir(cwd?: string): string {
  return path.join(cwd ?? process.cwd(), BASELINES_DIR)
}

function baselinePath(name: string, cwd?: string): string {
  return path.join(baselinesDir(cwd), `${name}.json`)
}

function baselineMetaPath(name: string, cwd?: string): string {
  return path.join(baselinesDir(cwd), `${name}.meta.json`)
}

export function findLatestResult(outputDir: string): string | null {
  const dir = path.resolve(outputDir)
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.startsWith('.'))
    .sort()
    .reverse()
  return files.length > 0 ? path.join(dir, files[0]) : null
}

export interface SaveBaselineOptions {
  description?: string
  cwd?: string
}

/**
 * Save a baseline. Accepts either a legacy (string cwd) third argument or
 * a `SaveBaselineOptions` object so existing call sites keep working.
 */
export function saveBaseline(
  name: string,
  resultPath: string,
  cwdOrOpts?: string | SaveBaselineOptions
): string {
  const opts: SaveBaselineOptions = typeof cwdOrOpts === 'string'
    ? { cwd: cwdOrOpts }
    : (cwdOrOpts ?? {})
  const dir = baselinesDir(opts.cwd)
  fs.mkdirSync(dir, { recursive: true })
  const dest = baselinePath(name, opts.cwd)
  fs.copyFileSync(resultPath, dest)

  // Write the sidecar metadata. We always write it (even with an empty
  // description) so the file's presence signals "saved through the new
  // code path"; legacy baselines without a sidecar still load OK.
  const meta: BaselineMetadata = {
    description: opts.description,
    savedAt: new Date().toISOString(),
  }
  fs.writeFileSync(baselineMetaPath(name, opts.cwd), JSON.stringify(meta, null, 2))
  return dest
}

export function loadBaselineMeta(name: string, cwd?: string): BaselineMetadata | null {
  const p = baselineMetaPath(name, cwd)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as BaselineMetadata
  } catch {
    return null
  }
}

export interface BaselineInfo {
  name: string
  date: string
  modelCount: number
  caseCount: number
  description?: string
}

export function listBaselines(cwd?: string): BaselineInfo[] {
  const dir = baselinesDir(cwd)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    // Exclude the `.meta.json` sidecars from the result listing; they're
    // looked up explicitly per baseline below.
    .filter(f => f.endsWith('.json') && !f.endsWith('.meta.json'))
    .map(f => {
      const name = f.replace(/\.json$/, '')
      const full = path.join(dir, f)
      try {
        const result = JSON.parse(fs.readFileSync(full, 'utf8')) as RunResult
        const meta = loadBaselineMeta(name, cwd)
        return {
          name,
          date: result.timestamp?.slice(0, 19).replace('T', ' ') ?? 'unknown',
          modelCount: result.models?.length ?? 0,
          caseCount: result.cases?.length ?? 0,
          description: meta?.description,
        }
      } catch {
        return { name, date: 'invalid', modelCount: 0, caseCount: 0 }
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function loadBaseline(name: string, cwd?: string): RunResult | null {
  const p = baselinePath(name, cwd)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as RunResult
  } catch {
    return null
  }
}

const REGRESSION_THRESHOLD = 0.5

export function compareWithBaseline(
  baseline: RunResult,
  current: RunResult,
  baselineName: string,
  baselineDescription?: string,
): BaselineComparison {
  const allModels = [...new Set([...baseline.models, ...current.models])]

  const deltas: BaselineDelta[] = []
  const newModels: string[] = []
  const removedModels: string[] = []
  let regressionAlert = false

  for (const model of allModels) {
    const a = baseline.summary[model]
    const b = current.summary[model]

    if (!a && b) {
      newModels.push(model)
      continue
    }
    if (a && !b) {
      removedModels.push(model)
      continue
    }
    if (a && b) {
      const delta = b.avg_total - a.avg_total
      const pctChange = a.avg_total > 0 ? (delta / a.avg_total) * 100 : 0
      const regression = delta < -REGRESSION_THRESHOLD
      if (regression) regressionAlert = true
      deltas.push({
        model,
        scoreA: a.avg_total,
        scoreB: b.avg_total,
        delta: +delta.toFixed(2),
        pctChange: +pctChange.toFixed(1),
        regression,
      })
    }
  }

  return {
    baselineName,
    baselineDate: baseline.timestamp?.slice(0, 19).replace('T', ' ') ?? 'unknown',
    baselineDescription,
    deltas,
    newModels,
    removedModels,
    regressionAlert,
  }
}
