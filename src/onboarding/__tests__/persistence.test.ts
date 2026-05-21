import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { OnboardingMark } from '../events.js'

// Each test gets its own tempdir as $HOME so the module's resolved
// VERDICT_DIR points there.
const tmpRoots: string[] = []

let persistence: typeof import('../persistence.js')

beforeEach(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-onboarding-'))
  tmpRoots.push(tmp)
  vi.spyOn(os, 'homedir').mockReturnValue(tmp)
  vi.resetModules()
  persistence = await import('../persistence.js')
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const t of tmpRoots.splice(0)) {
    fs.rmSync(t, { recursive: true, force: true })
  }
})

const validMark: OnboardingMark = {
  version: 1,
  status: 'in-progress',
  startedAt: '2026-05-19T12:00:00.000Z',
  pulledModels: [],
}

describe('persistence', () => {
  it('readMark returns null when no file exists', () => {
    expect(persistence.readMark()).toBeNull()
  })

  it('writeMark + readMark round-trips', () => {
    persistence.writeMark(validMark)
    expect(persistence.readMark()).toEqual(validMark)
  })

  it('readMark returns null on invalid JSON', () => {
    persistence.ensureVerdictDir()
    fs.writeFileSync(persistence.getMarkPath(), '{not json')
    expect(persistence.readMark()).toBeNull()
  })

  it('readMark returns null on schema mismatch (wrong version)', () => {
    persistence.ensureVerdictDir()
    fs.writeFileSync(
      persistence.getMarkPath(),
      JSON.stringify({ ...validMark, version: 99 })
    )
    expect(persistence.readMark()).toBeNull()
  })

  it('writeMark is atomic (no temp file lingers on success)', () => {
    persistence.writeMark(validMark)
    const dir = persistence.getVerdictDir()
    const lingering = fs
      .readdirSync(dir)
      .filter(f => f.startsWith('onboarding.json.tmp.'))
    expect(lingering).toEqual([])
  })

  it('deleteMark removes the file (idempotent)', () => {
    persistence.writeMark(validMark)
    persistence.deleteMark()
    expect(persistence.readMark()).toBeNull()
    expect(() => persistence.deleteMark()).not.toThrow()
  })

  it('isMarkStale: in-progress > 24h is stale', () => {
    const fresh: OnboardingMark = {
      ...validMark,
      startedAt: new Date(Date.now() - 1000).toISOString(),
    }
    const stale: OnboardingMark = {
      ...validMark,
      startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    }
    expect(persistence.isMarkStale(fresh)).toBe(false)
    expect(persistence.isMarkStale(stale)).toBe(true)
  })

  it('isMarkStale: completed marks are not stale', () => {
    const completed: OnboardingMark = {
      ...validMark,
      status: 'completed',
      startedAt: new Date(Date.now() - 999 * 24 * 60 * 60 * 1000).toISOString(),
    }
    expect(persistence.isMarkStale(completed)).toBe(false)
  })
})
