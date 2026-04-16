/**
 * Orchestrator for post-run notifications on scheduled evals.
 *
 * Usage (from the daemon worker after an `eval` job completes):
 *
 *   await notifyRegression({ schedule, result, scheduleMetadata })
 *
 * Behavior:
 *   1. Look up the schedule's `on_regression` config.
 *   2. Detect regressions vs the configured baseline (if any).
 *   3. If regressed: POST to webhook (if set) and print to stdout.
 */

import type { ScheduleRow } from '../db/client.js'
import type { RunResult } from '../types/index.js'
import { detectRegression, type RegressionReport } from './regression.js'
import { postWebhook, type WebhookResult } from './webhook.js'

export { detectRegression, postWebhook }
export type { RegressionReport, WebhookResult }

export interface OnRegressionConfig {
  webhook?: string
  stdout?: boolean
  baseline?: string
}

export interface NotifyRegressionOpts {
  schedule: ScheduleRow
  result: RunResult
  /** Optional override for the baselines directory (for tests). */
  cwd?: string
  /** Optional logger. Defaults to console.log. */
  log?: (msg: string) => void
}

export interface NotifyRegressionOutcome {
  /** null when schedule has no on_regression config or no baseline is set. */
  report: RegressionReport | null
  /** Populated only when regressed AND webhook was configured. */
  webhook?: WebhookResult
}

export async function notifyRegression(opts: NotifyRegressionOpts): Promise<NotifyRegressionOutcome> {
  const { schedule, result } = opts
  const log = opts.log ?? ((m: string) => console.log(m))
  if (!schedule.on_regression) return { report: null }

  let cfg: OnRegressionConfig
  try {
    cfg = JSON.parse(schedule.on_regression) as OnRegressionConfig
  } catch {
    return { report: null }
  }

  const report = detectRegression(result, cfg.baseline, opts.cwd)
  if (!report || !report.regressed) return { report }

  if (cfg.stdout !== false) {
    log(formatStdout(schedule.name, report))
  }

  let webhook: WebhookResult | undefined
  if (cfg.webhook) {
    const payload = buildPayload(schedule.name, result, report)
    webhook = await postWebhook(cfg.webhook, payload)
    if (!webhook.ok) {
      log(`[notify] webhook to ${cfg.webhook} failed: ${webhook.error}`)
    }
  }

  return { report, webhook }
}

export function buildPayload(
  scheduleName: string,
  result: RunResult,
  report: RegressionReport,
): Record<string, unknown> {
  const summaryLine = report.regressions
    .map(r => `${r.model}: ${r.scoreA.toFixed(1)} → ${r.scoreB.toFixed(1)} (${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)})`)
    .join(', ')

  return {
    text: `⚠ verdict: regression detected in schedule "${scheduleName}" — ${summaryLine}`,
    schedule: scheduleName,
    run_id: result.run_id,
    run_name: result.name,
    timestamp: result.timestamp,
    baseline: report.baselineName,
    regressions: report.regressions,
    new_models: report.newModels,
    removed_models: report.removedModels,
  }
}

function formatStdout(scheduleName: string, report: RegressionReport): string {
  const lines: string[] = []
  lines.push(`⚠ Regression detected in schedule "${scheduleName}" vs baseline "${report.baselineName}":`)
  for (const r of report.regressions) {
    lines.push(`    ${r.model}: ${r.scoreA.toFixed(2)} → ${r.scoreB.toFixed(2)} (Δ ${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}, ${r.pctChange.toFixed(1)}%)`)
  }
  return lines.join('\n')
}
