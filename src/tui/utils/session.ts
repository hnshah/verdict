/**
 * Persisted session state for the TUI — keeps user context across launches.
 * Location: ~/.verdict/tui-session.json
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Screen } from '../hooks/useKeymap.js'

const SESSION_PATH = path.join(os.homedir(), '.verdict', 'tui-session.json')

export interface Session {
  lastScreen?: Screen
  filterQueries?: Partial<Record<Screen, string>>
}

export function loadSession(): Session {
  try {
    return JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')) as Session
  } catch {
    return {}
  }
}

export function saveSession(s: Session): void {
  try {
    fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true })
    fs.writeFileSync(SESSION_PATH, JSON.stringify(s, null, 2))
  } catch { /* best-effort */ }
}

/** Merge patch into existing session and write back. */
export function updateSession(patch: Partial<Session>): void {
  const prev = loadSession()
  saveSession({ ...prev, ...patch })
}
