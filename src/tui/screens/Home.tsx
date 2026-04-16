/**
 * Home screen — at-a-glance dashboard.
 *
 * - Top model leaderboard with sparkline trends
 * - Daemon status + job queue depth
 * - Combined score trend chart (all models over the last N runs)
 * - Latest run summary (if any)
 */

import { useMemo } from 'react'
import { Box, Text } from 'ink'
import { theme, scoreColor } from '../theme.js'
import { useHistory, useJobs } from '../hooks/useDb.js'
import { useDaemonStatus } from '../hooks/useDaemon.js'
import { useSchedules } from '../hooks/useSchedules.js'
import { describeNext } from '../../scheduler/cron.js'
import { Sparkline } from '../components/Sparkline.js'
import { Chart } from '../components/Chart.js'
import { Clickable } from '../components/Clickable.js'
import type { EvalHistoryRow } from '../../db/client.js'

export interface HomeProps {
  onOpenRun?: (row: EvalHistoryRow) => void
}

interface ModelAgg {
  model_id: string
  runs: number
  avgScore: number
  scoreHistory: number[]
  lastScore: number
  lastSeen: string
}

function aggregateByModel(rows: EvalHistoryRow[]): ModelAgg[] {
  const byModel = new Map<string, ModelAgg>()
  const chrono = [...rows].reverse()
  for (const r of chrono) {
    const agg = byModel.get(r.model_id) ?? {
      model_id: r.model_id, runs: 0, avgScore: 0, scoreHistory: [],
      lastScore: r.score, lastSeen: r.run_at,
    }
    agg.runs += 1
    agg.avgScore = (agg.avgScore * (agg.runs - 1) + r.score) / agg.runs
    agg.scoreHistory.push(r.score)
    agg.lastScore = r.score
    agg.lastSeen = r.run_at
    byModel.set(r.model_id, agg)
  }
  return [...byModel.values()].sort((a, b) => b.avgScore - a.avgScore)
}

function detectRegressions(agg: ModelAgg[]): ModelAgg[] {
  return agg.filter(m => {
    if (m.scoreHistory.length < 3) return false
    const prev = m.scoreHistory.slice(-4, -1)
    const latest = m.lastScore
    // Flag if latest is meaningfully below the best of the previous 3 runs.
    // Using max (not avg) surfaces gradual slides that avg-based checks miss.
    const prevMax = Math.max(...prev)
    return latest < prevMax - 0.4
  })
}

export function Home({ onOpenRun }: HomeProps = {}) {
  const { rows } = useHistory({ limit: 200 }, 5000)
  const { rows: jobs } = useJobs(undefined, 3000)
  const { status, reachable } = useDaemonStatus()
  const { rows: schedules } = useSchedules(5000)

  // Find the single nearest upcoming scheduled run across all enabled schedules.
  const nextScheduled = useMemo(() => {
    const upcoming = schedules
      .filter(s => s.enabled && s.next_run_at)
      .map(s => ({ name: s.name, at: new Date(s.next_run_at!) }))
      .filter(s => !Number.isNaN(s.at.getTime()))
      .sort((a, b) => a.at.getTime() - b.at.getTime())
    return upcoming[0] ?? null
  }, [schedules])

  const agg = useMemo(() => aggregateByModel(rows), [rows])
  const top = agg.slice(0, 8)
  const regressions = useMemo(() => detectRegressions(agg), [agg])

  const queued = jobs.filter(j => j.status === 'queued').length
  const running = jobs.filter(j => j.status === 'running').length

  const chartSeries = top.slice(0, 4).map(m => {
    const s = m.scoreHistory.slice(-20)
    // pad to length of longest series for asciichart
    return s
  })
  const maxLen = chartSeries.reduce((m, s) => Math.max(m, s.length), 0)
  const paddedSeries = chartSeries.map(s => {
    if (s.length >= maxLen) return s
    const pad = Array(maxLen - s.length).fill(s[0] ?? 0)
    return [...pad, ...s]
  })

  const latestRun = rows[0]

  return (
    <Box flexDirection="column">
      {/* Regression banner */}
      {regressions.length > 0 && (
        <Box marginBottom={1} borderStyle="single" borderColor={theme.danger} paddingX={1}>
          <Text color={theme.danger} bold>⚠ {regressions.length} model{regressions.length === 1 ? '' : 's'} regressed vs recent average: </Text>
          <Text color={theme.text}>{regressions.map(r => r.model_id).join(', ')}</Text>
        </Box>
      )}

      <Box marginBottom={1}>
        <Text color={theme.accent} bold>⚡ Top models  </Text>
        <Text color={theme.muted}>(avg across {rows.length} runs)</Text>
      </Box>

      {top.length === 0 && (
        <Text color={theme.muted}>
          No runs yet. Press <Text color={theme.highlight}>:</Text> and run{' '}
          <Text color={theme.highlight}>New Run (custom)</Text>, or <Text color={theme.highlight}>verdict run</Text>.
        </Text>
      )}

      {top.map((m, i) => (
        <Box key={m.model_id}>
          <Text color={theme.muted}>{String(i + 1).padStart(2)}. </Text>
          <Text color={theme.text}>{m.model_id.padEnd(30).slice(0, 30)}  </Text>
          <Text color={scoreColor(m.avgScore)} bold>{m.avgScore.toFixed(2).padStart(5)}  </Text>
          <Sparkline values={m.scoreHistory.slice(-20)} />
          <Text color={theme.muted}>  {m.runs} run{m.runs === 1 ? '' : 's'}  </Text>
          <Text color={scoreColor(m.lastScore)}>last {m.lastScore.toFixed(2)}</Text>
        </Box>
      ))}

      {/* Trend chart */}
      {paddedSeries.length >= 1 && paddedSeries[0].length >= 2 && (
        <Box marginTop={2} flexDirection="column">
          <Text color={theme.accent} bold>📈 Recent score trend  </Text>
          <Text color={theme.muted}>(top {paddedSeries.length} models, last {maxLen} runs)</Text>
          <Chart series={paddedSeries} height={6} min={0} max={10} />
        </Box>
      )}

      {/* Latest run summary */}
      {latestRun && (
        <Box marginTop={2} flexDirection="column">
          <Text color={theme.accent} bold>
            🕐 Most recent run
            {onOpenRun && <Text color={theme.muted}> (click to open)</Text>}
          </Text>
          <Clickable onClick={() => onOpenRun?.(latestRun)}>
            <Box flexDirection="column">
              <Text>
                <Text color={theme.muted}>  when:  </Text>
                {new Date(latestRun.run_at).toISOString().slice(0, 19).replace('T', ' ')}
              </Text>
              <Text>
                <Text color={theme.muted}>  model: </Text>
                <Text color={theme.text}>{latestRun.model_id}</Text>
                <Text color={theme.muted}>  pack: </Text>
                <Text color={theme.text}>{latestRun.pack}</Text>
              </Text>
              <Text>
                <Text color={theme.muted}>  score: </Text>
                <Text color={scoreColor(latestRun.score)} bold>{latestRun.score.toFixed(2)}</Text>
                <Text color={theme.muted}>   cases {latestRun.cases_run}</Text>
                <Text color={theme.muted}>   wins {latestRun.wins}</Text>
              </Text>
            </Box>
          </Clickable>
        </Box>
      )}

      {/* Next scheduled run */}
      {nextScheduled && (
        <Box marginTop={2} flexDirection="column">
          <Text color={theme.accent} bold>⏰ Next scheduled</Text>
          <Text>
            <Text color={theme.muted}>   </Text>
            <Text color={theme.text}>{nextScheduled.name}</Text>
            <Text color={theme.muted}>  {describeNext(nextScheduled.at)}</Text>
            <Text color={theme.muted} dimColor>  ({nextScheduled.at.toISOString().slice(0, 19).replace('T', ' ')})</Text>
          </Text>
        </Box>
      )}

      {/* Daemon status */}
      <Box marginTop={2} flexDirection="column">
        <Text color={theme.accent} bold>🛰  Daemon</Text>
        {reachable && status ? (
          <>
            <Text>   status: <Text color={theme.success}>running</Text>{' '}
              {status.uptimeSeconds !== undefined && (
                <Text color={theme.muted}>uptime {Math.floor(status.uptimeSeconds)}s</Text>
              )}
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
