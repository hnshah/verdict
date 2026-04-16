/**
 * Tests for the daemon's scheduler tick — i.e. the plumbing that walks the
 * `schedules` table, enqueues jobs, and advances next_run_at.
 *
 * Uses an in-memory DB (bypasses the real ~/.verdict/results.db) and injects
 * a custom now to avoid waiting on the wall clock.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  initSchema,
  addSchedule,
  getScheduleByName,
  getJobs,
} from '../../db/client.js'
import { VerdictDaemon } from '../index.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  return db
}

describe('VerdictDaemon scheduler tick', () => {
  let db: Database.Database
  let daemon: VerdictDaemon

  beforeEach(() => {
    db = createTestDb()
    // Long poll + scheduler interval so they don't fire during the test;
    // we call tickScheduler() manually.
    daemon = new VerdictDaemon({ pollIntervalMs: 60_000, schedulerIntervalMs: 60_000, db })
    daemon.start()
  })

  afterEach(() => { daemon.stop() })

  it('enqueues an eval job for each due schedule', () => {
    addSchedule(db, { name: 'now', cron: '@hourly', next_run_at: null })
    addSchedule(db, { name: 'past', cron: '@hourly', next_run_at: '2020-01-01T00:00:00Z' })
    addSchedule(db, {
      name: 'future',
      cron: '@hourly',
      next_run_at: new Date(Date.now() + 3600_000).toISOString(),
    })

    const fired = daemon.tickScheduler()
    expect(fired).toBe(2)

    const jobs = getJobs(db, { status: 'queued' })
    expect(jobs).toHaveLength(2)
    for (const j of jobs) {
      expect(j.type).toBe('eval')
      expect(j.priority).toBe(5)
      const meta = JSON.parse(j.metadata!)
      expect(meta.scheduleId).toBeGreaterThan(0)
      expect(['now', 'past']).toContain(meta.scheduleName)
    }
  })

  it('advances next_run_at after firing', () => {
    addSchedule(db, { name: 's', cron: '@hourly', next_run_at: null })
    daemon.tickScheduler()
    const row = getScheduleByName(db, 's')!
    expect(row.next_run_at).not.toBeNull()
    expect(new Date(row.next_run_at!).getTime()).toBeGreaterThan(Date.now())
    expect(row.last_run_at).not.toBeNull()
  })

  it('does not fire disabled schedules', () => {
    addSchedule(db, { name: 'off', cron: '@hourly', enabled: false, next_run_at: null })
    const fired = daemon.tickScheduler()
    expect(fired).toBe(0)
    expect(getJobs(db, { status: 'queued' })).toHaveLength(0)
  })

  it('forwards packs/models/category fields into job input', () => {
    addSchedule(db, {
      name: 's',
      cron: '@hourly',
      config_path: './verdict.yaml',
      packs: 'general,coding',
      models: 'qwen,llama',
      category: 'math',
      next_run_at: null,
    })
    daemon.tickScheduler()

    const job = getJobs(db, { status: 'queued' })[0]
    const input = JSON.parse(job.input!)
    expect(input.configPath).toBe('./verdict.yaml')
    expect(input.packs).toEqual(['general', 'coding'])
    expect(input.models).toEqual(['qwen', 'llama'])
    expect(input.category).toEqual(['math'])
  })
})

describe('VerdictDaemon.syncYamlSchedules', () => {
  let tmp: string
  let db: Database.Database

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-syncy-'))
    db = createTestDb()
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('upserts yaml schedules and marks source=yaml', () => {
    const configPath = path.join(tmp, 'verdict.yaml')
    fs.writeFileSync(configPath, [
      'schedules:',
      '  - name: nightly',
      '    cron: "0 2 * * *"',
      '    packs: [general, coding]',
      '  - name: hourly',
      '    cron: "@hourly"',
    ].join('\n'))

    const daemon = new VerdictDaemon({ pollIntervalMs: 60_000, schedulerIntervalMs: 60_000, db })
    const count = daemon.syncYamlSchedules(configPath)
    expect(count).toBe(2)

    const nightly = getScheduleByName(db, 'nightly')!
    expect(nightly.source).toBe('yaml')
    expect(nightly.cron).toBe('0 2 * * *')
    expect(nightly.packs).toBe('general,coding')
    expect(nightly.next_run_at).not.toBeNull()

    const hourly = getScheduleByName(db, 'hourly')!
    expect(hourly.source).toBe('yaml')
  })

  it('removes yaml rows that disappear from the file on re-sync', () => {
    const configPath = path.join(tmp, 'verdict.yaml')
    fs.writeFileSync(configPath, 'schedules:\n  - name: a\n    cron: "@hourly"\n  - name: b\n    cron: "@daily"\n')

    const daemon = new VerdictDaemon({ pollIntervalMs: 60_000, schedulerIntervalMs: 60_000, db })
    daemon.syncYamlSchedules(configPath)
    expect(getScheduleByName(db, 'a')).not.toBeNull()
    expect(getScheduleByName(db, 'b')).not.toBeNull()

    // Remove `b`
    fs.writeFileSync(configPath, 'schedules:\n  - name: a\n    cron: "@hourly"\n')
    daemon.syncYamlSchedules(configPath)
    expect(getScheduleByName(db, 'a')).not.toBeNull()
    expect(getScheduleByName(db, 'b')).toBeNull()
  })

  it('leaves CLI schedules alone when syncing yaml', () => {
    addSchedule(db, { name: 'from-cli', cron: '@daily', source: 'cli' })
    const configPath = path.join(tmp, 'verdict.yaml')
    fs.writeFileSync(configPath, 'schedules:\n  - name: from-yaml\n    cron: "@hourly"\n')

    const daemon = new VerdictDaemon({ pollIntervalMs: 60_000, schedulerIntervalMs: 60_000, db })
    daemon.syncYamlSchedules(configPath)

    const cli = getScheduleByName(db, 'from-cli')!
    expect(cli.source).toBe('cli')
    expect(getScheduleByName(db, 'from-yaml')).not.toBeNull()
  })

  it('skips invalid cron expressions instead of throwing', () => {
    const configPath = path.join(tmp, 'verdict.yaml')
    fs.writeFileSync(configPath, 'schedules:\n  - name: bad\n    cron: "not-a-cron"\n  - name: good\n    cron: "@hourly"\n')

    const daemon = new VerdictDaemon({ pollIntervalMs: 60_000, schedulerIntervalMs: 60_000, db })
    const count = daemon.syncYamlSchedules(configPath)
    expect(count).toBe(1)
    expect(getScheduleByName(db, 'bad')).toBeNull()
    expect(getScheduleByName(db, 'good')).not.toBeNull()
  })

  it('returns 0 when the config file does not exist', () => {
    const daemon = new VerdictDaemon({ pollIntervalMs: 60_000, schedulerIntervalMs: 60_000, db })
    expect(daemon.syncYamlSchedules(path.join(tmp, 'no-such-file.yaml'))).toBe(0)
  })
})
