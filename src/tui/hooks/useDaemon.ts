/**
 * Subscribe to daemon state. Polls the Unix-socket IPC at ~/.verdict/daemon.sock
 * and tails ~/.verdict/daemon.log for live output.
 */

import { useEffect, useState, useRef } from 'react'
import fs from 'fs'
import { sendIpc } from '../../daemon/ipc.js'
import { LOG_FILE } from '../../daemon/index.js'
import type { DaemonStatus } from '../../daemon/index.js'

export function useDaemonStatus(refreshMs = 3000) {
  const [status, setStatus] = useState<DaemonStatus | null>(null)
  const [reachable, setReachable] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    sendIpc({ action: 'status' })
      .then(res => {
        if (cancelled) return
        if (res.ok && res.data) {
          setStatus(res.data as DaemonStatus)
          setReachable(true)
        } else {
          setReachable(false)
        }
      })
      .catch(() => { if (!cancelled) setReachable(false) })
    return () => { cancelled = true }
  }, [tick])

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), refreshMs)
    return () => clearInterval(t)
  }, [refreshMs])

  return { status, reachable, refresh: () => setTick(x => x + 1) }
}

/** Tail the daemon log file — returns the last `maxLines` lines, kept fresh. */
export function useDaemonLog(maxLines = 200, refreshMs = 1000) {
  const [lines, setLines] = useState<string[]>([])
  const lastSize = useRef(0)

  useEffect(() => {
    const read = () => {
      try {
        const stat = fs.statSync(LOG_FILE)
        if (stat.size === lastSize.current) return
        lastSize.current = stat.size
        const buf = fs.readFileSync(LOG_FILE, 'utf8')
        const all = buf.split('\n').filter(Boolean)
        setLines(all.slice(-maxLines))
      } catch {
        setLines([])
      }
    }
    read()
    const t = setInterval(read, refreshMs)
    return () => clearInterval(t)
  }, [maxLines, refreshMs])

  return lines
}
