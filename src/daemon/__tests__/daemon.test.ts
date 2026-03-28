import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema, addJob, updateJob, getNextJob, getJobs } from '../../db/client.js'
import type { JobInsert, JobRow } from '../../db/client.js'
import { VerdictDaemon } from '../index.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  return db
}

describe('job helpers', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
  })

  describe('addJob', () => {
    it('inserts a job and returns its id', () => {
      const id = addJob(db, { type: 'eval' })
      expect(id).toBe(1)

      const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow
      expect(row.type).toBe('eval')
      expect(row.status).toBe('queued')
      expect(row.priority).toBe(0)
    })

    it('respects priority and metadata', () => {
      const id = addJob(db, {
        type: 'summarize',
        model_id: 'qwen2.5:32b',
        input: JSON.stringify({ text: 'hello' }),
        priority: 5,
        metadata: JSON.stringify({ source: 'test' }),
      })

      const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow
      expect(row.priority).toBe(5)
      expect(row.model_id).toBe('qwen2.5:32b')
      expect(JSON.parse(row.input!)).toEqual({ text: 'hello' })
      expect(JSON.parse(row.metadata!)).toEqual({ source: 'test' })
    })

    it('auto-increments ids', () => {
      const id1 = addJob(db, { type: 'eval' })
      const id2 = addJob(db, { type: 'batch' })
      expect(id2).toBe(id1 + 1)
    })
  })

  describe('updateJob', () => {
    it('updates status and timestamps', () => {
      const id = addJob(db, { type: 'eval' })
      const now = new Date().toISOString()
      updateJob(db, id, { status: 'running', started_at: now })

      const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow
      expect(row.status).toBe('running')
      expect(row.started_at).toBe(now)
    })

    it('updates output and error', () => {
      const id = addJob(db, { type: 'summarize' })
      updateJob(db, id, { status: 'done', output: 'Summary text' })

      const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow
      expect(row.output).toBe('Summary text')
    })

    it('does nothing when no fields provided', () => {
      const id = addJob(db, { type: 'eval' })
      updateJob(db, id, {})

      const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow
      expect(row.status).toBe('queued')
    })
  })

  describe('getNextJob', () => {
    it('returns null when queue is empty', () => {
      expect(getNextJob(db)).toBeNull()
    })

    it('returns the highest priority queued job', () => {
      addJob(db, { type: 'eval', priority: 1 })
      addJob(db, { type: 'summarize', priority: 10 })
      addJob(db, { type: 'batch', priority: 5 })

      const next = getNextJob(db)!
      expect(next.type).toBe('summarize')
      expect(next.priority).toBe(10)
    })

    it('returns oldest job when priorities are equal', () => {
      addJob(db, { type: 'eval', priority: 0 })
      addJob(db, { type: 'summarize', priority: 0 })

      const next = getNextJob(db)!
      expect(next.type).toBe('eval')
    })

    it('skips non-queued jobs', () => {
      const id1 = addJob(db, { type: 'eval' })
      addJob(db, { type: 'summarize' })
      updateJob(db, id1, { status: 'running' })

      const next = getNextJob(db)!
      expect(next.type).toBe('summarize')
    })
  })

  describe('getJobs', () => {
    it('returns all jobs by default', () => {
      addJob(db, { type: 'eval' })
      addJob(db, { type: 'summarize' })
      addJob(db, { type: 'batch' })

      const jobs = getJobs(db)
      expect(jobs.length).toBe(3)
    })

    it('filters by status', () => {
      const id1 = addJob(db, { type: 'eval' })
      addJob(db, { type: 'summarize' })
      updateJob(db, id1, { status: 'done', completed_at: new Date().toISOString() })

      const queued = getJobs(db, { status: 'queued' })
      expect(queued.length).toBe(1)
      expect(queued[0].type).toBe('summarize')

      const done = getJobs(db, { status: 'done' })
      expect(done.length).toBe(1)
      expect(done[0].type).toBe('eval')
    })

    it('respects limit', () => {
      for (let i = 0; i < 10; i++) addJob(db, { type: 'eval' })

      const jobs = getJobs(db, { limit: 3 })
      expect(jobs.length).toBe(3)
    })
  })
})

describe('VerdictDaemon', () => {
  let db: Database.Database
  let daemon: VerdictDaemon

  beforeEach(() => {
    db = createTestDb()
    daemon = new VerdictDaemon({ pollIntervalMs: 100, db })
  })

  afterEach(() => {
    daemon.stop()
  })

  it('reports status correctly when idle', () => {
    const status = daemon.getStatus()
    expect(status.running).toBe(false)
    expect(status.currentJob).toBeNull()
    expect(status.queueDepth).toBe(0)
    expect(status.completedToday).toBe(0)
    expect(status.failedToday).toBe(0)
  })

  it('tracks queue depth', () => {
    addJob(db, { type: 'eval' })
    addJob(db, { type: 'summarize' })

    const status = daemon.getStatus()
    expect(status.queueDepth).toBe(2)
  })

  it('starts and stops', () => {
    daemon.start()
    expect(daemon.isRunning()).toBe(true)

    daemon.stop()
    expect(daemon.isRunning()).toBe(false)
  })

  it('does not double-start', () => {
    daemon.start()
    daemon.start() // should be a no-op
    expect(daemon.isRunning()).toBe(true)
  })
})
