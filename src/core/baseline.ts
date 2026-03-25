import fs from 'fs'
import path from 'path'
import type { RunResult, BaselineComparison, BaselineDelta } from '../types/index.js'

const BASELINES_DIR = '.verdict-baselines'

function baselinesDir(cwd?: string): string {
  return path.join(cwd ?? process.cwd(), BASELINES_DIR)
}

function baselinePath(name: string, cwd?: string): string {
  return path.join(baselinesDir(cwd), `${name}.json`)
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

export function saveBaseline(name: string, resultPath: string, cwd?: string): string {
  const dir = baselinesDir(cwd)
  fs.mkdirSync(dir, { recursive: true })
  const dest = baselinePath(name, cwd)
  fs.copyFileSync(resultPath, dest)
  return dest
}

export interface BaselineInfo {
  name: string
  date: string
  modelCount: number
  caseCount: number
}

export function listBaselines(cwd?: string): BaselineInfo[] {
  const dir = baselinesDir(cwd)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const full = path.join(dir, f)
      try {
        const result = JSON.parse(fs.readFileSync(full, 'utf8')) as RunResult
        return {
          name: f.replace('.json', ''),
          date: result.timestamp?.slice(0, 19).replace('T', ' ') ?? 'unknown',
          modelCount: result.models?.length ?? 0,
          caseCount: result.cases?.length ?? 0,
        }
      } catch {
        return { name: f.replace('.json', ''), date: 'invalid', modelCount: 0, caseCount: 0 }
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

export function compareWithBaseline(baseline: RunResult, current: RunResult, baselineName: string): BaselineComparison {
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
    deltas,
    newModels,
    removedModels,
    regressionAlert,
  }
}
