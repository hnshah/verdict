import { Box, Text, useInput } from 'ink'
import { theme } from '../../theme.js'
import type { OnboardingState } from '../../../onboarding/index.js'

export interface PlanProps {
  state: Extract<OnboardingState, { kind: 'plan' }>
  onNext: () => void
  onBack: () => void
}

export function Plan({ state, onNext, onBack }: PlanProps) {
  useInput((input, key) => {
    if (key.return) onNext()
    if (input === 'b' || key.escape) onBack()
  })
  const { plan, snapshot } = state
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text color={theme.accent} bold>Plan: {plan.intent}</Text>
        <Text color={theme.muted}>{plan.rationale}</Text>
      </Box>

      <Box flexDirection="column">
        <Text color={theme.text} bold>Detected hardware</Text>
        <Text color={theme.muted}>
          {'  '}{snapshot.hardware.cpu} · {snapshot.hardware.ramGB} GB RAM · {snapshot.hardware.os}
          {snapshot.hardware.freeDiskGB !== undefined ? ` · ${snapshot.hardware.freeDiskGB} GB free` : ''}
        </Text>
      </Box>

      {plan.installSteps.length > 0 && (
        <Box flexDirection="column">
          <Text color={theme.text} bold>Install steps</Text>
          {plan.installSteps.map((s, i) => (
            <Text color={theme.muted} key={i}>
              {'  '}{i + 1}. {s.label}
              {s.estimatedSeconds ? <Text color={theme.dim}> ~{s.estimatedSeconds}s</Text> : null}
            </Text>
          ))}
        </Box>
      )}

      {plan.modelsToPull.length > 0 && (
        <Box flexDirection="column">
          <Text color={theme.text} bold>Models to pull ({plan.estimatedDownloadGB.toFixed(1)} GB total)</Text>
          {plan.modelsToPull.map(m => (
            <Text color={theme.muted} key={m.name}>
              {'  • '}<Text color={theme.text}>{m.name}</Text> <Text color={theme.dim}>· {m.paramsB}B {m.defaultQuant} · ~{m.estimatedSizeGB} GB · {m.role}</Text>
            </Text>
          ))}
        </Box>
      )}

      {plan.reuseModels.length > 0 && (
        <Box flexDirection="column">
          <Text color={theme.text} bold>Reusing already-installed</Text>
          {plan.reuseModels.map(m => (
            <Text color={theme.muted} key={m}>{'  • '}{m}</Text>
          ))}
        </Box>
      )}

      {plan.cloudModels.length > 0 && (
        <Box flexDirection="column">
          <Text color={theme.text} bold>Cloud models</Text>
          {plan.cloudModels.map(m => (
            <Text color={theme.muted} key={m.id}>{'  • '}{m.id} <Text color={theme.dim}>{m.model}</Text></Text>
          ))}
        </Box>
      )}

      <Box flexDirection="column">
        <Text color={theme.text} bold>Judge</Text>
        <Text color={theme.muted}>{'  '}{plan.judge.modelId} — {plan.judge.rationale}</Text>
      </Box>

      <Text color={theme.dim}>
        Estimated total: {plan.estimatedDurationMin[0].toFixed(1)}–{plan.estimatedDurationMin[1].toFixed(1)} min
      </Text>

      <Box marginTop={1}>
        <Text color={theme.accent}>Enter</Text>
        <Text color={theme.muted}> to continue · </Text>
        <Text color={theme.accent}>b</Text>
        <Text color={theme.muted}> back · </Text>
        <Text color={theme.accent}>q</Text>
        <Text color={theme.muted}> quit</Text>
      </Box>
    </Box>
  )
}
