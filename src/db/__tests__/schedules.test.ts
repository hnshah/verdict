import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import {
  initSchema,
  addSchedule,
  upsertSchedule,
  listSchedules,
  getScheduleByName,
  getDueSchedules,
  updateSchedule,
  removeSchedule,
  removeYamlSchedules,
} from '../client.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  return db
}

describe('schedules DB helpers', () => {
  let db: Database.Database
  beforeEach(() => { db = createTestDb() })

  it('adds and retrieves a schedule by name', () => {
    const id = addSchedule(db, {
      name: 'nightly',
      cron: '0 2 * * *',
      packs: 'general,coding',
      source: 'cli',
    })
    expect(id).toBeGreaterThan(0)

    const row = getScheduleByName(db, 'nightly')
    expect(row).not.toBeNull()
    expect(row!.cron).toBe('0 2 * * *')
    expect(row!.packs).toBe('general,coding')
    expect(row!.enabled).toBe(1)
    expect(row!.source).toBe('cli')
  })

  it('serializes on_regression config as JSON', () => {
    addSchedule(db, {
      name: 's1',
      cron: '@hourly',
      on_regression: { webhook: 'https://example.com/hook', baseline: 'prod', stdout: true },
    })
    const row = getScheduleByName(db, 's1')!
    const parsed = JSON.parse(row.on_regression!)
    expect(parsed.webhook).toBe('https://example.com/hook')
    expect(parsed.baseline).toBe('prod')
  })

  it('unique name constraint blocks duplicates via addSchedule', () => {
    addSchedule(db, { name: 'dup', cron: '@hourly' })
    expect(() => addSchedule(db, { name: 'dup', cron: '@daily' })).toThrow()
  })

  it('upsertSchedule updates fields when name exists', () => {
    upsertSchedule(db, { name: 'up', cron: '@hourly', source: 'yaml' })
    upsertSchedule(db, { name: 'up', cron: '@daily',  source: 'yaml' })
    const row = getScheduleByName(db, 'up')!
    expect(row.cron).toBe('@daily')
    expect(listSchedules(db)).toHaveLength(1)
  })

  it('listSchedules with enabledOnly skips paused rows', () => {
    addSchedule(db, { name: 'on',  cron: '@hourly', enabled: true })
    addSchedule(db, { name: 'off', cron: '@hourly', enabled: false })
    expect(listSchedules(db)).toHaveLength(2)
    const enabled = listSchedules(db, { enabledOnly: true })
    expect(enabled).toHaveLength(1)
    expect(enabled[0].name).toBe('on')
  })

  it('getDueSchedules returns only enabled rows with past/null next_run_at', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const future = new Date(Date.now() + 60_000).toISOString()
    addSchedule(db, { name: 'past',    cron: '@hourly', next_run_at: past })
    addSchedule(db, { name: 'future',  cron: '@hourly', next_run_at: future })
    addSchedule(db, { name: 'paused',  cron: '@hourly', next_run_at: past, enabled: false })
    addSchedule(db, { name: 'null',    cron: '@hourly', next_run_at: null })

    const due = getDueSchedules(db)
    const names = due.map(r => r.name).sort()
    expect(names).toEqual(['null', 'past'])
  })

  it('updateSchedule mutates allowed fields', () => {
    addSchedule(db, { name: 'u', cron: '@hourly' })
    const row = getScheduleByName(db, 'u')!
    updateSchedule(db, row.id, { enabled: 0, last_status: 'regression', last_run_at: '2026-04-15T02:00:00Z' })
    const after = getScheduleByName(db, 'u')!
    expect(after.enabled).toBe(0)
    expect(after.last_status).toBe('regression')
    expect(after.last_run_at).toBe('2026-04-15T02:00:00Z')
  })

  it('removeSchedule returns true iff a row was deleted', () => {
    addSchedule(db, { name: 'del', cron: '@hourly' })
    expect(removeSchedule(db, 'del')).toBe(true)
    expect(removeSchedule(db, 'del')).toBe(false)
    expect(getScheduleByName(db, 'del')).toBeNull()
  })

  it('removeYamlSchedules only removes source=yaml rows', () => {
    addSchedule(db, { name: 'a', cron: '@hourly', source: 'yaml' })
    addSchedule(db, { name: 'b', cron: '@hourly', source: 'cli' })
    addSchedule(db, { name: 'c', cron: '@hourly', source: 'yaml' })
    expect(removeYamlSchedules(db)).toBe(2)
    const remaining = listSchedules(db).map(r => r.name)
    expect(remaining).toEqual(['b'])
  })
})
