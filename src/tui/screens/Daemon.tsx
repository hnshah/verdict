/**
 * Daemon screen — live status, job queue, and tailing log.
 *
 * Uses the existing IPC socket and tails ~/.verdict/daemon.log.
 * Press `p` to pause auto-scroll (lazygit-style).
 */

import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from '../theme.js'
import { useDaemonStatus, useDaemonLog } from '../hooks/useDaemon.js'
import { useJobs } from '../hooks/useDb.js'
import { Table, type Column } from '../components/Table.js'
import { LogStream } from '../components/LogStream.js'
import type { JobRow } from '../../db/client.js'

export interface DaemonProps {
  onBack?: () => void
}

export function Daemon(_props: DaemonProps) {
  const { status, reachable } = useDaemonStatus(2000)
  const { rows: jobs } = useJobs(undefined, 2000)
  const log = useDaemonLog(500, 1000)
  const [paused, setPaused] = useState(false)
  const [savedLog, setSavedLog] = useState<string[]>([])

  useInput((input) => {
    if (input === 'p') {
      if (!paused) setSavedLog(log)
      setPaused(p => !p)
    }
    if (input === 'G' && paused) {
      setPaused(false)
    }
  })

  const displayLog = paused ? savedLog : log

  const jobCols: Column<JobRow>[] = [
    { key: 'id',     header: 'ID',     width: 5, align: 'right', render: j => String(j.id) },
    { key: 'type',   header: 'TYPE',   width: 14, render: j => j.type },
    { key: 'status', header: 'STATUS', width: 8,  render: j => j.status,
      color: j => j.status === 'done' ? theme.success
             : j.status === 'running' ? theme.primary
             : j.status === 'failed' ? theme.danger
             : theme.warning },
    { key: 'model',  header: 'MODEL',  width: 22, render: j => j.model_id ?? '-' },
    { key: 'queued', header: 'QUEUED', width: 20, render: j => (j.queued_at ?? '').slice(0, 19).replace('T', ' ') },
  ]

  return (
    <Box flexDirection="column">
      {/* Status line */}
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>🛰  Daemon</Text>
        <Text>  </Text>
        {reachable && status ? (
          <>
            <Text color={theme.success}>● running</Text>
            {status.pid !== undefined && <Text color={theme.muted}>  pid {status.pid}</Text>}
            {status.uptimeSeconds !== undefined && (
              <Text color={theme.muted}>  up {Math.floor(status.uptimeSeconds)}s</Text>
            )}
            <Text color={theme.muted}>  queue {status.queueDepth}</Text>
            <Text color={theme.muted}>  today  </Text>
            <Text color={theme.success}>✓{status.completedToday}</Text>
            <Text color={theme.muted}> </Text>
            <Text color={theme.danger}>✗{status.failedToday}</Text>
          </>
        ) : (
          <Text color={theme.danger}>● stopped</Text>
        )}
      </Box>

      {!reachable && (
        <Text color={theme.muted}>
          Start it with: <Text color={theme.highlight}>verdict daemon start</Text>
        </Text>
      )}

      {/* Jobs */}
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.accent} bold>Recent jobs</Text>
        <Table
          rows={jobs}
          columns={jobCols}
          height={7}
          focused={false}
          emptyMessage={reachable ? 'No jobs yet' : 'Daemon not reachable'}
        />
      </Box>

      {/* Log */}
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={theme.accent} bold>Log tail  </Text>
          {paused
            ? <Text color={theme.warning}>[PAUSED — press G or p to resume]</Text>
            : <Text color={theme.muted}>(auto · p to pause)</Text>
          }
        </Box>
        <LogStream lines={displayLog} height={10} paused={paused} />
      </Box>
    </Box>
  )
}
