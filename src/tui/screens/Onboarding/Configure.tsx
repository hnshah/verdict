import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import { theme } from '../../theme.js'
import type { OnboardingState } from '../../../onboarding/index.js'

export interface ConfigureProps {
  state: Extract<OnboardingState, { kind: 'configure' }>
}

export function Configure({ state }: ConfigureProps) {
  if (!state.previewYaml) {
    return (
      <Box>
        <Spinner label="Rendering verdict.yaml…" />
      </Box>
    )
  }
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.text}>
        Writing <Text color={theme.accent}>verdict.yaml</Text>{' '}
        <Text color={theme.muted}>({state.action})</Text>
      </Text>

      {state.hasExisting && state.diff ? (
        <Box flexDirection="column" borderStyle="single" borderColor={theme.borderDim} paddingX={1}>
          <Text color={theme.dim} bold>diff vs existing</Text>
          {truncate(state.diff, 20).map((line, i) => (
            <Text key={i} color={diffColor(line)}>{line}</Text>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column" borderStyle="single" borderColor={theme.borderDim} paddingX={1}>
          <Text color={theme.dim} bold>preview</Text>
          {state.previewYaml.split('\n').slice(0, 24).map((line, i) => (
            <Text key={i} color={theme.muted}>{line}</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

function truncate(diff: string, n: number): string[] {
  const lines = diff.split('\n')
  return lines.length > n ? [...lines.slice(0, n), `… (${lines.length - n} more lines)`] : lines
}

function diffColor(line: string): string {
  if (line.startsWith('+++')) return theme.accent
  if (line.startsWith('---')) return theme.accent
  if (line.startsWith('+')) return theme.success
  if (line.startsWith('-')) return theme.danger
  return theme.muted
}
