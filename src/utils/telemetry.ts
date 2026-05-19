/**
 * Opt-in anonymous telemetry.
 *
 * Goal: let the project measure its north-star metric — machines that ran a
 * Verdict eval in the last 7 days — without leaking any user data.
 *
 * Sent: { install_id, day, models_count, packs_count, verdict_version }
 * Never sent: prompts, scores, model names, file paths, hostnames, user names.
 *
 * Default: OFF. Users opt in with `verdict telemetry on` or by accepting the
 * prompt during `verdict init`. Stored prefs live at ~/.verdict/telemetry.json.
 *
 * Endpoint: pulled from VERDICT_TELEMETRY_URL env var. If unset, the module
 * no-ops (records nothing locally, sends nothing). This lets us ship the
 * mechanism now without a live server.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'

export interface TelemetryPrefs {
  /** True if the user opted in. */
  enabled: boolean
  /** Anonymous random UUID; never tied to user/email/hostname. */
  install_id: string
  /** ISO timestamp of consent decision (either direction). */
  decided_at: string
}

export interface TelemetryPayload {
  install_id: string
  /** Local date (YYYY-MM-DD), not timestamp — coarse on purpose. */
  day: string
  /** Count of models in the config that produced this run. */
  models_count: number
  /** Count of eval packs run. */
  packs_count: number
  /** Verdict version string. */
  verdict_version: string
}

const PREFS_PATH = path.join(os.homedir(), '.verdict', 'telemetry.json')

export function loadPrefs(): TelemetryPrefs | null {
  try {
    if (!fs.existsSync(PREFS_PATH)) return null
    const raw = fs.readFileSync(PREFS_PATH, 'utf-8')
    const prefs = JSON.parse(raw) as TelemetryPrefs
    if (typeof prefs.enabled !== 'boolean' || typeof prefs.install_id !== 'string') return null
    return prefs
  } catch {
    return null
  }
}

export function savePrefs(prefs: TelemetryPrefs): void {
  fs.mkdirSync(path.dirname(PREFS_PATH), { recursive: true })
  fs.writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 2))
}

/**
 * Opt the install in. Generates a new install_id if none exists.
 */
export function enable(): TelemetryPrefs {
  const existing = loadPrefs()
  const prefs: TelemetryPrefs = {
    enabled: true,
    install_id: existing?.install_id ?? randomUUID(),
    decided_at: new Date().toISOString(),
  }
  savePrefs(prefs)
  return prefs
}

/**
 * Opt the install out. Keeps the install_id (so later re-enabling doesn't
 * generate a new one) but won't be used while disabled.
 */
export function disable(): TelemetryPrefs {
  const existing = loadPrefs()
  const prefs: TelemetryPrefs = {
    enabled: false,
    install_id: existing?.install_id ?? randomUUID(),
    decided_at: new Date().toISOString(),
  }
  savePrefs(prefs)
  return prefs
}

/**
 * Fire-and-forget telemetry ping. Returns immediately; the network call is
 * orphaned. Never throws — telemetry failures must not affect the user.
 */
export function ping(payload: Omit<TelemetryPayload, 'install_id' | 'day'>): void {
  try {
    const prefs = loadPrefs()
    if (!prefs?.enabled) return

    const endpoint = process.env['VERDICT_TELEMETRY_URL']
    if (!endpoint) return // mechanism ready, server not configured

    const body: TelemetryPayload = {
      install_id: prefs.install_id,
      day: new Date().toISOString().slice(0, 10),
      ...payload,
    }

    // Fire-and-forget; do not await. Catch any error to be extra safe.
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => { /* silently drop */ })
  } catch {
    // Never propagate telemetry errors.
  }
}

/**
 * Show a one-line status message users can paste into bug reports.
 */
export function statusLine(): string {
  const prefs = loadPrefs()
  if (!prefs) return 'telemetry: not configured (default off)'
  if (!prefs.enabled) return `telemetry: off (decided ${prefs.decided_at.slice(0, 10)})`
  return `telemetry: on, install_id=${prefs.install_id.slice(0, 8)}…`
}
