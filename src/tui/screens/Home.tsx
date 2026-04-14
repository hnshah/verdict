/**
 * Home screen — at-a-glance dashboard.
 * Shows top models (avg score across recent runs), daemon status, job queue depth.
 */

import { useMemo } from 'react'
import { Box, Text } from 'ink'
import { theme, scoreColor } from '../theme.js'
import { useHistory, useJobs } from '../hooks/useDb.js'
import { useDaemonStatus } from '../hooks/useDaemon.js'
import { Sparkline } from '../components/Sparkline.js'
import type { EvalHistoryRow } from '../../db/client.js'

interface ModelAgg {
  model_id: string
  runs: number
  avgScore: number
  scoreHistory: number[]
  lastSeen: string
}

function aggregateByModel(rows: EvalHistoryRow[]): ModelAgg[] {
  const byModel = new Map<string, ModelAgg>()
  // rows come in date DESC; walk in reverse so scoreHistory is chronological
  const chrono = [...rows].reverse()
  for (const r of chrono) {
    const agg = byModel.get(r.model_id) ?? {
      model_id: r.model_id, runs: 0, avgScore: 0, scoreHistory: [], lastSeen: r.run_at,
    }
    agg.runs += 1
    agg.avgScore = (agg.avgScore * (agg.runs - 1) + r.score) / agg.runs
    agg.scoreHistory.push(r.score)
    agg.lastSeen = r.run_at
    byModel.set(r.model_id, agg)
  }
  return [...byModel.values()].sort((a, b) => b.avgScore - a.avgScore)
}

export function Home() {
  const { rows } = useHistory({ limit: 200 }, 5000)
  const { rows: jobs } = useJobs(undefined, 3000)
  const { status, reachable } = useDaemonStatus()

  const agg = useMemo(() => aggregateByModel(rows), [rows])
  const top = agg.slice(0, 8)

  const queued = jobs.filter(j => j.status === 'queued').length
  const running = jobs.filter(j => j.status === 'running').length

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>⚡ Top models  </Text>
        <Text color={theme.muted}>(avg across {rows.length} runs)</Text>
      </Box>

      {top.length === 0 && (
        <Text color={theme.muted}>
          No runs yet. Press <Text color={theme.highlight}>:</Text> and run{' '}
          <Text color={theme.highlight}>New Live Run</Text>, or use <Text color={theme.highlight}>verdict run</Text>.
        </Text>
      )}

      {top.map((m, i) => (
        <Box key={m.model_id}>
          <Text color={theme.muted}>{String(i + 1).padStart(2)}. </Text>
          <Text color={theme.text}>{m.model_id.padEnd(32).slice(0, 32)}  </Text>
          <Text color={scoreColor(m.avgScore)} bold>{m.avgScore.toFixed(2).padStart(5)}  </Text>
          <Sparkline values={m.scoreHistory.slice(-20)} />
          <Text color={theme.muted}>  {m.runs} run{m.runs === 1 ? '' : 's'}</Text>
        </Box>
      ))}

      {/* Daemon status */}
      <Box marginTop={2} flexDirection="column">
        <Text color={theme.accent} bold>🛰  Daemon</Text>
        {reachable && status ? (
          <>
            <Text>   status: <Text color={theme.success}>running</Text>{' '}
              {status.uptimeSeconds ? <Text color={theme.muted}>uptime {Math.floor(status.uptimeSeconds)}s</Text> : null}
            </Text>
            <Text>   queue:  <Text color={theme.text}>{status.queueDepth}</Text>{' '}
              <Text color={theme.muted}>({running} running, {queued} queued)</Text>
            </Text>
            <Text>   today:  <Text color={theme.success}>✓ {status.completedToday}</Text>{' '}
              <Text color={theme.danger}>✗ {status.failedToday}</Text>
            </Text>
          </>
        ) : (
          <Text color={theme.muted}>
            {'   '}stopped — run <Text color={theme.highlight}>verdict daemon start</Text>
          </Text>
        )}
      </Box>
    </Box>
  )
}
