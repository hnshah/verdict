import { Box, Text } from 'ink'
import { theme } from '../../theme.js'
import type { OnboardingState } from '../../../onboarding/index.js'

const STEPS = [
  { kind: 'welcome', label: 'Welcome' },
  { kind: 'detect', label: 'Detect' },
  { kind: 'plan', label: 'Plan' },
  { kind: 'consent', label: 'Consent' },
  { kind: 'install', label: 'Install' },
  { kind: 'pull', label: 'Pull' },
  { kind: 'configure', label: 'Configure' },
  { kind: 'verify', label: 'Verify' },
  { kind: 'first-run', label: 'First Run' },
  { kind: 'done', label: 'Done' },
] as const

export function StateHeader({ state }: { state: OnboardingState }) {
  // Terminal states use the "from" field as the position indicator.
  const activeKind: (typeof STEPS)[number]['kind'] =
    state.kind === 'cancelled' || state.kind === 'failed'
      ? (state.from as (typeof STEPS)[number]['kind'])
      : (state.kind as (typeof STEPS)[number]['kind'])
  const idx = STEPS.findIndex(s => s.kind === activeKind)
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={theme.accent} bold>verdict onboarding</Text>
        <Text color={theme.muted}>  step {Math.max(0, idx) + 1}/{STEPS.length}: </Text>
        <Text color={theme.primary} bold>{STEPS[Math.max(0, idx)]?.label}</Text>
      </Box>
      <Box>
        {STEPS.map((s, i) => {
          const done = i < idx
          const active = i === idx
          const color = active ? theme.accent : done ? theme.success : theme.muted
          const marker = done ? '●' : active ? '◉' : '○'
          return (
            <Text key={s.kind} color={color}>{marker}{i < STEPS.length - 1 ? '─' : ''}</Text>
          )
        })}
      </Box>
    </Box>
  )
}
