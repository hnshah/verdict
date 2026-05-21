import { Box, Text, useInput } from 'ink'
import { theme } from '../../theme.js'
import type {
  OnboardingState,
  PlanSelections,
} from '../../../onboarding/index.js'

export interface ConsentProps {
  state: Extract<OnboardingState, { kind: 'consent' }>
  onConfirm: () => void
  onBack: () => void
  onEdit: (selections: PlanSelections) => void
}

export function Consent({ state, onConfirm, onBack, onEdit }: ConsentProps) {
  const telemetryOn = state.selections.telemetryOptIn === true
  useInput((input, key) => {
    if (input === 'y' || input === 'Y' || key.return) onConfirm()
    if (input === 'b' || input === 'n' || input === 'N' || key.escape) onBack()
    // Toggle telemetry opt-in. We store true/false explicitly so the engine
    // knows the user actually made a choice (undefined = unanswered).
    if (input === 't' || input === 'T') {
      onEdit({ ...state.selections, telemetryOptIn: !telemetryOn })
    }
  })
  const willInstall = state.plan.installSteps.length > 0
  const willPull = state.plan.modelsToPull.length > 0
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.warning} bold>Before we proceed</Text>
      <Box flexDirection="column">
        {willInstall && (
          <Text color={theme.text}>
            • We'll run <Text color={theme.accent}>{state.plan.installSteps.length}</Text> install step(s) on your machine.
          </Text>
        )}
        {willPull && (
          <Text color={theme.text}>
            • We'll download <Text color={theme.accent}>{state.selections.modelsToPull.length}</Text> model(s)
            (~<Text color={theme.accent}>{state.plan.estimatedDownloadGB.toFixed(1)} GB</Text>).
          </Text>
        )}
        <Text color={theme.text}>
          • We'll write to <Text color={theme.accent}>{state.plan.config.targetPath}</Text>
          {state.plan.config.action === 'replace-with-backup' && (
            <Text color={theme.muted}> (existing file backed up)</Text>
          )}
          {state.plan.config.action === 'merge' && (
            <Text color={theme.muted}> (merge — existing models preserved)</Text>
          )}.
        </Text>
        <Text color={theme.text}>
          • You can cancel anytime with <Text color={theme.accent}>Ctrl-C</Text>.
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.text}>
          <Text color={telemetryOn ? theme.success : theme.muted}>
            {telemetryOn ? '☑' : '☐'}
          </Text>{' '}
          Help us count installs? (anonymous, opt-in)
        </Text>
        <Text color={theme.dim}>
          {'  '}Sends: install id, day, model/pack counts, verdict version. Never prompts/scores/paths.
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.accent}>y</Text>
        <Text color={theme.muted}> or </Text>
        <Text color={theme.accent}>Enter</Text>
        <Text color={theme.muted}> to proceed · </Text>
        <Text color={theme.accent}>n</Text>
        <Text color={theme.muted}> / </Text>
        <Text color={theme.accent}>b</Text>
        <Text color={theme.muted}> to go back · </Text>
        <Text color={theme.accent}>t</Text>
        <Text color={theme.muted}> to toggle telemetry</Text>
      </Box>
    </Box>
  )
}
