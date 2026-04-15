/**
 * LiveRun — start an eval and watch progress in real time.
 *
 * MVP: uses the verdict.yaml in cwd, shows a single Start action, then streams
 * runner onProgress() messages via useLiveRun.
 */

import { useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { Spinner } from '@inkjs/ui'
import { theme, scoreColor } from '../theme.js'
import { LogStream } from '../components/LogStream.js'
import { useLiveRun } from '../hooks/useLiveRun.js'
import { useConfig } from '../hooks/useConfig.js'

export interface LiveRunProps {
  onBack: () => void
}

export function LiveRun({ onBack: _onBack }: LiveRunProps) {
  const { state, start } = useLiveRun()
  const { config, error: cfgErr } = useConfig('./verdict.yaml')

  // Auto-start on mount if config loaded and idle — easier for MVP than a form
  useEffect(() => {
    if (state.phase === 'idle' && config) {
      start({ configPath: './verdict.yaml' })
    }
  }, [state.phase, config, start])

  useInput((input) => {
    if (input === 'r' && state.phase !== 'running') {
      start({ configPath: './verdict.yaml' })
    }
  })

  if (cfgErr) {
    return (
      <Box flexDirection="column">
        <Text color={theme.danger}>Config error</Text>
        <Text color={theme.muted}>{cfgErr}</Text>
        <Text color={theme.muted}>{'\n'}Esc to go back</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>▶ Live run</Text>
        {config && <Text color={theme.muted}>
          {'  '}·  {config.models.length} model{config.models.length === 1 ? '' : 's'}
          {'  ·  judge: '}{config.judge.model}
          {'  ·  concurrency: '}{config.run.concurrency}
        </Text>}
      </Box>

      {state.phase === 'running' && (
        <Box flexDirection="column">
          <Box>
            <Spinner />
            <Text color={theme.primary}> {state.current || 'starting…'}</Text>
          </Box>
          {state.casesTotal > 0 && (
            <Text color={theme.muted}>
              {'  '}case {state.casesCompleted}/{state.casesTotal}
              {state.casesCompleted > 0 && state.startedAt && (() => {
                const elapsed = (Date.now() - state.startedAt) / 1000
                const per = elapsed / state.casesCompleted
                const remaining = (state.casesTotal - state.casesCompleted) * per
                return <Text color={theme.muted}>  ·  eta ~{Math.ceil(remaining)}s</Text>
              })()}
            </Text>
          )}
        </Box>
      )}
      {state.phase === 'done' && (
        <Text color={theme.success} bold>✓ Done. Press r to run again, Esc to go back.</Text>
      )}
      {state.phase === 'error' && (
        <Box flexDirection="column">
          <Text color={theme.danger}>✗ {state.error}</Text>
          <Text color={theme.muted}>Press r to retry</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <LogStream lines={state.log} height={14} title="progress" />
      </Box>

      {state.result && (
        <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor={theme.borderDim} paddingX={1}>
          <Text color={theme.accent} bold>Summary</Text>
          {Object.values(state.result.summary)
            .sort((a, b) => b.avg_total - a.avg_total)
            .slice(0, 8)
            .map((s, i) => (
              <Box key={s.model_id}>
                <Text color={theme.muted}>{String(i + 1).padStart(2)}. </Text>
                <Text>{s.model_id.padEnd(30).slice(0, 30)} </Text>
                <Text color={scoreColor(s.avg_total)} bold>{s.avg_total.toFixed(2).padStart(5)}</Text>
                <Text color={theme.muted}>  wins {s.wins}/{s.cases_run}</Text>
              </Box>
            ))}
        </Box>
      )}
    </Box>
  )
}
