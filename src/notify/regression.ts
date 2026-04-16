/**
 * Regression detection for scheduled runs.
 *
 * After a schedule-triggered eval completes, we compare the fresh result
 * against the schedule's baseline (by name) or the run immediately preceding
 * it (fall-through default) and return a report that the notifier can turn
 * into a webhook payload or stdout print.
 *
 * Wraps the existing `compareWithBaseline` from src/core/baseline.ts.
 */

import type { RunResult, BaselineDelta } from '../types/index.js'
import { loadBaseline, compareWithBaseline } from '../core/baseline.js'

export interface RegressionReport {
  regressed: boolean
  baselineName: string
  deltas: BaselineDelta[]
  regressions: BaselineDelta[]
  newModels: string[]
  removedModels: string[]
}

/**
 * Detect regressions in a fresh run against a baseline.
 * - If `baselineName` is supplied and the baseline exists, compares against it.
 * - If the baseline is missing (or no name given) → returns `null` so the
 *   caller can silently skip (no baseline = nothing to regress against).
 */
export function detectRegression(
  current: RunResult,
  baselineName: string | undefined,
  cwd?: string,
): RegressionReport | null {
  if (!baselineName) return null
  const baseline = loadBaseline(baselineName, cwd)
  if (!baseline) return null

  const cmp = compareWithBaseline(baseline, current, baselineName)
  const regressions = cmp.deltas.filter(d => d.regression)

  return {
    regressed: cmp.regressionAlert,
    baselineName: cmp.baselineName,
    deltas: cmp.deltas,
    regressions,
    newModels: cmp.newModels,
    removedModels: cmp.removedModels,
  }
}
