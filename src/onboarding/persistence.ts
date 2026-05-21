/**
 * Mark-file persistence for the onboarding flow. Writes are atomic (temp +
 * rename) so a crash during write never corrupts the file. Reads validate
 * with Zod and return null on any error — callers treat null as "no mark."
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { OnboardingMarkSchema, type OnboardingMark } from './events.js'

const VERDICT_DIR = path.join(os.homedir(), '.verdict')
const MARK_PATH = path.join(VERDICT_DIR, 'onboarding.json')

export function getMarkPath(): string {
  return MARK_PATH
}

export function getVerdictDir(): string {
  return VERDICT_DIR
}

export function ensureVerdictDir(): void {
  fs.mkdirSync(VERDICT_DIR, { recursive: true })
}

export function readMark(): OnboardingMark | null {
  try {
    if (!fs.existsSync(MARK_PATH)) return null
    const raw = fs.readFileSync(MARK_PATH, 'utf-8')
    const parsed = OnboardingMarkSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * Atomic write: serialize to temp, then rename. Rename is atomic on POSIX
 * within the same filesystem, so a crash mid-write leaves either the old
 * file or the new file — never a half-written one.
 */
export function writeMark(mark: OnboardingMark): void {
  ensureVerdictDir()
  const tmp = `${MARK_PATH}.tmp.${process.pid}.${Date.now()}`
  fs.writeFileSync(tmp, JSON.stringify(mark, null, 2))
  fs.renameSync(tmp, MARK_PATH)
}

export function deleteMark(): void {
  try {
    if (fs.existsSync(MARK_PATH)) fs.unlinkSync(MARK_PATH)
  } catch {
    // best-effort
  }
}

/**
 * Stale "in-progress" marks older than this are treated as abandoned and
 * cleared on next launch. 24 hours.
 */
export const STALE_IN_PROGRESS_MS = 24 * 60 * 60 * 1000

export function isMarkStale(mark: OnboardingMark, now = Date.now()): boolean {
  if (mark.status !== 'in-progress') return false
  const started = Date.parse(mark.startedAt)
  if (!Number.isFinite(started)) return true
  return now - started > STALE_IN_PROGRESS_MS
}
