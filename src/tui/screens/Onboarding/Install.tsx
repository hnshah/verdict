import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import { theme } from '../../theme.js'
import type { OnboardingState } from '../../../onboarding/index.js'

export interface InstallProps {
  state: Extract<OnboardingState, { kind: 'install' }>
}

export function Install({ state }: InstallProps) {
  if (state.steps.length === 0) {
    return (
      <Box>
        <Spinner label="Nothing to install — moving on…" />
      </Box>
    )
  }
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.text}>Installing dependencies…</Text>

      <Box flexDirection="column">
        {state.steps.map((s, i) => {
          const icon =
            s.state === 'done'    ? <Text color={theme.success}>  ✓ </Text>
          : s.state === 'failed'  ? <Text color={theme.danger}>  ✗ </Text>
          : s.state === 'running' ? <Text color={theme.primary}>  </Text>
                                  : <Text color={theme.muted}>  ○ </Text>
          const label =
            s.state === 'running' ? <Spinner label={s.step.label} />
                                  : <Text color={s.state === 'failed' ? theme.danger : theme.text}>{s.step.label}</Text>
          return (
            <Box key={i}>
              {icon}
              {label}
            </Box>
          )
        })}
      </Box>

      {state.steps[state.currentStep]?.log.length ? (
        <Box flexDirection="column" borderStyle="single" borderColor={theme.borderDim} paddingX={1}>
          <Text color={theme.dim} bold>output</Text>
          {state.steps[state.currentStep]!.log.slice(-8).map((line, i) => (
            <Text color={theme.muted} key={i}>{line}</Text>
          ))}
        </Box>
      ) : null}

      {state.steps[state.currentStep]?.errorMessage && (
        <Box>
          <Text color={theme.danger}>error: {state.steps[state.currentStep]!.errorMessage}</Text>
        </Box>
      )}
    </Box>
  )
}
