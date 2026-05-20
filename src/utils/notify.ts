/**
 * Notifications — fire on (a) new winner, (b) baseline regression,
 * (c) cron failure (called by external scripts).
 *
 * Channels:
 *   slack:  POST a Slack-compatible payload to a webhook URL.
 *   email:  print a `mail -s ...` invocation (caller wires `sendmail`).
 *   macos:  `osascript -e 'display notification ...'`.
 *
 * Config lives under `notify:` in verdict.yaml. Triggers default to all-on
 * but can be disabled per-channel.
 *
 * Like telemetry, notifications are fire-and-forget; a failed Slack POST or
 * missing osascript never breaks the run.
 */

import { spawn } from 'child_process'
import type { RunResult, BaselineComparison } from '../types/index.js'

export interface NotifyConfig {
  slack?: {
    webhook_url: string
    /** Slack channel override; webhook may not honor this. */
    channel?: string
  }
  macos?: {
    enabled?: boolean
  }
  email?: {
    /** Sendmail-compatible binary; default 'mail'. */
    binary?: string
    to: string
  }
  triggers?: {
    new_winner?: boolean
    regression?: boolean
    cron_failure?: boolean
  }
}

export interface NotifyEvent {
  kind: 'new_winner' | 'regression' | 'cron_failure'
  title: string
  body: string
}

/**
 * Compute the event(s) implied by a run result. Returns [] if nothing to say.
 */
export function eventsFromRun(
  result: RunResult,
  prevWinnerId?: string,
): NotifyEvent[] {
  const events: NotifyEvent[] = []

  const sorted = result.models
    .map(id => result.summary[id])
    .filter(s => s && s.cases_run > 0)
    .sort((a, b) => b.avg_total - a.avg_total)
  const winner = sorted[0]

  if (winner && prevWinnerId && winner.model_id !== prevWinnerId) {
    events.push({
      kind: 'new_winner',
      title: `Verdict: new winner — ${winner.model_id}`,
      body: `${winner.model_id} took #1 with ${winner.avg_total.toFixed(2)}/10 (was: ${prevWinnerId}).`,
    })
  }

  if (result.baselineComparison?.regressionAlert) {
    const regressed = result.baselineComparison.deltas
      .filter(d => d.regression)
      .map(d => `${d.model} ${d.delta.toFixed(2)}`)
      .join(', ')
    events.push({
      kind: 'regression',
      title: 'Verdict: baseline regression detected',
      body: `Regressed vs baseline "${result.baselineComparison.baselineName}": ${regressed}.`,
    })
  }

  return events
}

/**
 * Dispatch a notification event across all configured channels respecting
 * the trigger flags. Always async, always non-throwing.
 */
export async function dispatch(event: NotifyEvent, cfg?: NotifyConfig): Promise<void> {
  if (!cfg) return
  const triggers = cfg.triggers ?? {}
  if (event.kind === 'new_winner' && triggers.new_winner === false) return
  if (event.kind === 'regression' && triggers.regression === false) return
  if (event.kind === 'cron_failure' && triggers.cron_failure === false) return

  const tasks: Array<Promise<unknown>> = []
  if (cfg.slack?.webhook_url) tasks.push(sendSlack(event, cfg.slack))
  if (cfg.macos?.enabled !== false) tasks.push(sendMacOS(event))
  if (cfg.email?.to) tasks.push(sendEmail(event, cfg.email))

  await Promise.all(tasks.map(p => p.catch(() => { /* swallow */ })))
}

async function sendSlack(
  event: NotifyEvent,
  cfg: NonNullable<NotifyConfig['slack']>,
): Promise<void> {
  const color =
    event.kind === 'regression' ? '#dc2626' :
    event.kind === 'new_winner' ? '#16a34a' :
    '#facc15'
  const payload = {
    ...(cfg.channel ? { channel: cfg.channel } : {}),
    attachments: [{
      color,
      title: event.title,
      text: event.body,
      footer: 'verdict',
      ts: Math.floor(Date.now() / 1000),
    }],
  }
  await fetch(cfg.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

async function sendMacOS(event: NotifyEvent): Promise<void> {
  if (process.platform !== 'darwin') return
  const script = `display notification ${JSON.stringify(event.body)} with title ${JSON.stringify(event.title)}`
  await new Promise<void>((resolve) => {
    const child = spawn('osascript', ['-e', script])
    child.on('error', () => resolve())
    child.on('exit', () => resolve())
  })
}

async function sendEmail(
  event: NotifyEvent,
  cfg: NonNullable<NotifyConfig['email']>,
): Promise<void> {
  const bin = cfg.binary ?? 'mail'
  await new Promise<void>((resolve) => {
    const child = spawn(bin, ['-s', event.title, cfg.to])
    child.on('error', () => resolve())
    child.on('exit', () => resolve())
    child.stdin.write(event.body)
    child.stdin.end()
  })
}

/**
 * Helper that emits a notification given a fresh RunResult + the previous
 * winner (if any). Wires `eventsFromRun` + `dispatch`. Designed to be called
 * post-run from the CLI.
 */
export async function notifyRun(
  result: RunResult,
  cfg: NotifyConfig | undefined,
  prevWinnerId?: string,
): Promise<void> {
  if (!cfg) return
  const events = eventsFromRun(result, prevWinnerId)
  for (const ev of events) {
    await dispatch(ev, cfg)
  }
}

// Re-export helper type for the runner / cron callers.
export type { BaselineComparison }
