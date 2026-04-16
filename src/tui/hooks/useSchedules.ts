/**
 * Polls the schedules table at a fixed interval. Mirrors useJobs/useHistory.
 */

import { useEffect, useState } from 'react'
import { listSchedules, type ScheduleRow } from '../../db/client.js'
import { useDb } from './useDb.js'

export function useSchedules(refreshMs = 3000) {
  const db = useDb()
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    try {
      setRows(listSchedules(db))
    } catch {
      setRows([])
    }
  }, [tick, db])

  useEffect(() => {
    if (!refreshMs) return
    const t = setInterval(() => setTick(x => x + 1), refreshMs)
    return () => clearInterval(t)
  }, [refreshMs])

  return { rows, refresh: () => setTick(x => x + 1) }
}
