import { Box, Text, useInput } from 'ink'
import { theme } from '../../theme.js'
import type { OnboardingState } from '../../../onboarding/index.js'

export interface CancelledProps {
  state: Extract<OnboardingState, { kind: 'cancelled' }>
  onRetry: () => void
  onExit: () => void
}

export function Cancelled({ state, onRetry, onExit }: CancelledProps) {
  useInput((input, key) => {
    if (input === 'r' || input === 'R') onRetry()
    if (key.return || input === 'q' || input === 'Q') onExit()
  })
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.warning} bold>Cancelled</Text>
      <Text color={theme.muted}>
        Stopped at <Text color={theme.text}>{state.from}</Text>
        {state.reason ? <Text color={theme.muted}> ({state.reason})</Text> : null}.
      </Text>
      <Box marginTop={1}>
        <Text color={theme.accent}>r</Text>
        <Text color={theme.muted}> to restart · </Text>
        <Text color={theme.accent}>Enter</Text>
        <Text color={theme.muted}> or </Text>
        <Text color={theme.accent}>q</Text>
        <Text color={theme.muted}> to exit</Text>
      </Box>
    </Box>
  )
}
