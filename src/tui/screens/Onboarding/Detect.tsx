import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import { theme } from '../../theme.js'
import type { OnboardingState } from '../../../onboarding/index.js'

const LABELS: Record<string, string> = {
  hardware: 'Hardware (CPU/RAM/disk)',
  'ollama-bin': 'Ollama binary on PATH',
  'ollama-daemon': 'Ollama daemon running',
  mlx: 'MLX server (Apple Silicon)',
  lmstudio: 'LM Studio',
  cloud: 'Cloud API keys',
  network: 'Internet connectivity',
  homebrew: 'Homebrew',
  config: 'Existing verdict.yaml',
}

export function Detect({ state }: { state: Extract<OnboardingState, { kind: 'detect' }> }) {
  return (
    <Box flexDirection="column">
      <Text color={theme.text}>Looking at your machine…</Text>
      <Box flexDirection="column" marginTop={1}>
        {Object.entries(state.progress).map(([step, status]) => {
          const label = LABELS[step] ?? step
          if (status === 'pending') {
            return (
              <Box key={step}>
                <Text color={theme.muted}>  ○ {label}</Text>
              </Box>
            )
          }
          if (status === 'running') {
            return (
              <Box key={step}>
                <Text color={theme.primary}>  </Text>
                <Spinner label={label} />
              </Box>
            )
          }
          return (
            <Box key={step}>
              <Text color={theme.success}>  ✓ {label}</Text>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
