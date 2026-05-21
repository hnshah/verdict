import { Box, Text } from 'ink'
import { ProgressBar, Spinner } from '@inkjs/ui'
import { theme } from '../../theme.js'
import type {
  OnboardingState,
  PullTaskView,
} from '../../../onboarding/index.js'

export interface PullProps {
  state: Extract<OnboardingState, { kind: 'pull' }>
}

export function Pull({ state }: PullProps) {
  if (state.aggregate.totalTasks === 0) {
    return (
      <Box>
        <Spinner label="No models to pull — moving on…" />
      </Box>
    )
  }
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.text}>
        Pulling {state.aggregate.totalTasks} model(s) in parallel ·{' '}
        <Text color={theme.accent}>{state.aggregate.doneTasks}/{state.aggregate.totalTasks} done</Text>
        {state.aggregate.failedTasks > 0 && (
          <Text color={theme.danger}> · {state.aggregate.failedTasks} failed</Text>
        )}
      </Text>

      <Box flexDirection="column">
        <Text color={theme.muted}>Overall</Text>
        <Box>
          <ProgressBar value={clampPct(state.aggregate.overallPercent)} />
          <Text color={theme.dim}>  {state.aggregate.overallPercent.toFixed(0)}%</Text>
        </Box>
      </Box>

      <Box flexDirection="column">
        {Object.values(state.tasks)
          .sort((a, b) => a.modelName.localeCompare(b.modelName))
          .map(t => (
            <TaskRow key={t.modelName} task={t} />
          ))}
      </Box>
    </Box>
  )
}

function TaskRow({ task }: { task: PullTaskView }) {
  const color = phaseColor(task.phase)
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={color}>{task.phase.padEnd(11)}</Text>
        <Text color={theme.text} bold> {task.modelName}</Text>
        {task.attempt > 1 && (
          <Text color={theme.warning}>  (attempt {task.attempt})</Text>
        )}
      </Box>
      <Box>
        {task.percent >= 0 ? (
          <>
            <ProgressBar value={clampPct(task.percent)} />
            <Text color={theme.dim}>  {task.percent.toFixed(0)}%</Text>
          </>
        ) : (
          <Spinner label={task.phase} />
        )}
        <Text color={theme.dim}>  {humanRate(task.bytesPerSec)}  eta {humanEta(task.etaSeconds)}</Text>
      </Box>
      {task.errorMessage && (
        <Text color={theme.danger}>  ! {task.errorMessage}</Text>
      )}
    </Box>
  )
}

function phaseColor(phase: PullTaskView['phase']): string {
  switch (phase) {
    case 'done': return theme.success
    case 'failed': return theme.danger
    case 'canceled': return theme.muted
    case 'retrying': return theme.warning
    case 'queued': return theme.muted
    default: return theme.primary
  }
}

function clampPct(p: number): number {
  if (p < 0) return 0
  if (p > 100) return 100
  return p
}

function humanRate(bps: number): string {
  if (bps <= 0) return '—'
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 ** 2) return `${(bps / 1024).toFixed(1)} KB/s`
  if (bps < 1024 ** 3) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`
  return `${(bps / 1024 ** 3).toFixed(1)} GB/s`
}

function humanEta(s: number): string {
  if (s < 0) return '—'
  if (s < 60) return `${s}s`
  return `${Math.round(s / 60)}m`
}
