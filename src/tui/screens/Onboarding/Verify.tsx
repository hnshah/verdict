import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import { theme } from '../../theme.js'
import type { OnboardingState } from '../../../onboarding/index.js'

export interface VerifyProps {
  state: Extract<OnboardingState, { kind: 'verify' }>
}

export function Verify({ state }: VerifyProps) {
  if (!state.result) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={theme.text}>Running a smoke eval to prove everything works end-to-end…</Text>
        <Box>
          <Spinner label="running 2-prompt smoke test" />
        </Box>
      </Box>
    )
  }
  const r = state.result
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={r.ok ? theme.success : theme.danger} bold>
        {r.ok ? '✓ Smoke eval passed' : '✗ Smoke eval failed'}
      </Text>
      <Box flexDirection="column">
        <Text color={theme.muted}>Model:  {r.modelCalled}</Text>
        <Text color={theme.muted}>Judge:  {r.judgeCalled}</Text>
        {r.exampleResponse && (
          <Text color={theme.muted}>Sample: <Text color={theme.text}>{r.exampleResponse}</Text></Text>
        )}
        {r.exampleScore > 0 && (
          <Text color={theme.muted}>Score:  {r.exampleScore.toFixed(1)}/10</Text>
        )}
        <Text color={theme.dim}>{(r.durationMs / 1000).toFixed(1)}s</Text>
      </Box>
      {r.failures.length > 0 && (
        <Box flexDirection="column">
          <Text color={theme.danger} bold>Failures</Text>
          {r.failures.map((f, i) => (
            <Text key={i} color={theme.danger}>  • [{f.step}] {f.error}</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
