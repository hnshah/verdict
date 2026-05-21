import { Box, Text } from 'ink'
import { Spinner, ProgressBar } from '@inkjs/ui'
import { theme } from '../../theme.js'
import type { OnboardingState } from '../../../onboarding/index.js'

export interface FirstRunProps {
  state: Extract<OnboardingState, { kind: 'first-run' }>
}

export function FirstRun({ state }: FirstRunProps) {
  const { view, result } = state

  if (result && !result.ok) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={theme.warning} bold>First eval didn't complete</Text>
        <Text color={theme.muted}>{result.errorMessage ?? 'unknown error'}</Text>
        <Text color={theme.dim}>
          You can re-run any time with <Text color={theme.accent}>verdict run</Text>.
        </Text>
      </Box>
    )
  }

  if (result && result.ok) {
    const sorted = Object.entries(result.modelScores).sort((a, b) => b[1] - a[1])
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={theme.success} bold>First eval complete</Text>
        <Box flexDirection="column">
          {sorted.map(([id, score], i) => (
            <Text key={id} color={id === result.winner ? theme.success : theme.muted}>
              {'  '}{i + 1}. <Text color={theme.text}>{id}</Text>
              {'  '}<Text color={theme.dim}>{score.toFixed(2)}/10</Text>
              {id === result.winner ? <Text color={theme.success}>  ← winner</Text> : null}
            </Text>
          ))}
        </Box>
        <Text color={theme.dim}>
          Saved to your local results.db ({result.casesRun} cases, {(result.durationMs / 1000).toFixed(1)}s)
        </Text>
      </Box>
    )
  }

  const pct = view.casesTotal > 0 ? (view.casesDone / view.casesTotal) * 100 : 0
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.text}>
        Running your first real eval against{' '}
        <Text color={theme.accent}>{view.models.length}</Text> model(s) on{' '}
        <Text color={theme.accent}>{view.casesTotal}</Text> cases…
      </Text>
      <Box flexDirection="column">
        <Text color={theme.muted}>
          Progress: {view.casesDone}/{view.casesTotal} cases
        </Text>
        {view.casesTotal > 0 ? (
          <ProgressBar value={Math.max(0, Math.min(100, pct))} />
        ) : (
          <Spinner label="starting" />
        )}
      </Box>
      {view.current && (
        <Text color={theme.dim}>{view.current}</Text>
      )}
    </Box>
  )
}
