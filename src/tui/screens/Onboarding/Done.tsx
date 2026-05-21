import { Box, Text, useInput } from 'ink'
import { theme } from '../../theme.js'
import type { OnboardingState } from '../../../onboarding/index.js'

export interface DoneProps {
  state: Extract<OnboardingState, { kind: 'done' }>
  onExit: () => void
}

export function Done({ state, onExit }: DoneProps) {
  useInput((_input, key) => {
    if (key.return) onExit()
  })
  const s = state.summary
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.success} bold>You're set up.</Text>
      <Box flexDirection="column">
        {s.pulledModels.length > 0 && (
          <Text color={theme.muted}>
            Pulled <Text color={theme.text}>{s.pulledModels.length}</Text> model(s):{' '}
            <Text color={theme.accent}>{s.pulledModels.join(', ')}</Text>
          </Text>
        )}
        {s.reusedModels.length > 0 && (
          <Text color={theme.muted}>
            Reusing <Text color={theme.text}>{s.reusedModels.length}</Text> installed model(s):{' '}
            <Text color={theme.accent}>{s.reusedModels.join(', ')}</Text>
          </Text>
        )}
        {s.configPath && (
          <Text color={theme.muted}>
            Config: <Text color={theme.accent}>{s.configPath}</Text>
          </Text>
        )}
        {s.configBackupPath && (
          <Text color={theme.muted}>
            Backup: <Text color={theme.dim}>{s.configBackupPath}</Text>
          </Text>
        )}
        {s.smokeScore !== undefined && s.smokeScore > 0 && (
          <Text color={theme.muted}>
            Smoke score: <Text color={theme.success}>{s.smokeScore.toFixed(1)}/10</Text>
          </Text>
        )}
        <Text color={theme.dim}>Took {(s.totalDurationMs / 1000).toFixed(1)}s.</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.text} bold>What's next</Text>
        <Text color={theme.muted}>  • <Text color={theme.accent}>verdict run</Text> — run your first full eval</Text>
        <Text color={theme.muted}>  • <Text color={theme.accent}>verdict tui</Text> — explore results in the dashboard</Text>
        <Text color={theme.muted}>  • <Text color={theme.accent}>verdict serve --ui</Text> — open the local web UI</Text>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.accent}>Enter</Text>
        <Text color={theme.muted}> to exit</Text>
      </Box>
    </Box>
  )
}
