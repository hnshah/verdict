/**
 * Thin hook around the existing SQLite client in src/db/client.ts.
 * Opens the DB once on mount and exposes memoized query helpers that re-run
 * when their args change.
 */

import { useEffect, useMemo, useState } from 'react'
import type Database from 'better-sqlite3'
import { getDb, initSchema, queryHistory, getJobs } from '../../db/client.js'
import type { EvalHistoryRow, HistoryOpts, JobRow } from '../../db/client.js'

let cachedDb: Database.Database | null = null

function openDb(): Database.Database {
  if (cachedDb) return cachedDb
  const db = getDb()
  initSchema(db)
  cachedDb = db
  return db
}

export function useDb() {
  const db = useMemo(() => openDb(), [])
  return db
}

/** Poll history every `refreshMs` ms. Returns rows + a manual refresh function. */
export function useHistory(opts: HistoryOpts = {}, refreshMs = 5000) {
  const db = useDb()
  const [rows, setRows] = useState<EvalHistoryRow[]>([])
  const [tick, setTick] = useState(0)
  const key = JSON.stringify(opts)

  useEffect(() => {
    let cancelled = false
    try {
      const r = queryHistory(db, opts)
      if (!cancelled) setRows(r)
    } catch {
      if (!cancelled) setRows([])
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick, db])

  useEffect(() => {
    if (!refreshMs) return
    const t = setInterval(() => setTick(x => x + 1), refreshMs)
    return () => clearInterval(t)
  }, [refreshMs])

  return { rows, refresh: () => setTick(x => x + 1) }
}

export function useJobs(status?: string, refreshMs = 3000) {
  const db = useDb()
  const [rows, setRows] = useState<JobRow[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    try {
      const r = getJobs(db, { status, limit: 20 })
      setRows(r)
    } catch {
      setRows([])
    }
  }, [tick, status, db])

  useEffect(() => {
    if (!refreshMs) return
    const t = setInterval(() => setTick(x => x + 1), refreshMs)
    return () => clearInterval(t)
  }, [refreshMs])

  return { rows, refresh: () => setTick(x => x + 1) }
}
