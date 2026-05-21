import { Box, Text, useInput } from 'ink'
import { theme } from '../../theme.js'
import type { OnboardingState } from '../../../onboarding/index.js'

export interface FailedProps {
  state: Extract<OnboardingState, { kind: 'failed' }>
  onRetry: () => void
  onExit: () => void
}

export function Failed({ state, onRetry, onExit }: FailedProps) {
  useInput((input, key) => {
    if (state.recoverable && (input === 'r' || input === 'R')) onRetry()
    if (key.return || input === 'q' || input === 'Q') onExit()
  })
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.danger} bold>Failed at {state.from}</Text>
      <Text color={theme.danger}>{state.error}</Text>
      <Box marginTop={1}>
        {state.recoverable && (
          <>
            <Text color={theme.accent}>r</Text>
            <Text color={theme.muted}> to retry · </Text>
          </>
        )}
        <Text color={theme.accent}>Enter</Text>
        <Text color={theme.muted}> or </Text>
        <Text color={theme.accent}>q</Text>
        <Text color={theme.muted}> to exit</Text>
      </Box>
    </Box>
  )
}
