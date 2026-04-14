/**
 * Auto-scrolling log pane. Last-N-lines view of a string[] source.
 * Pause behavior is Phase 2 — for MVP we always show the tail.
 */

import { Box, Text } from 'ink'
import { theme } from '../theme.js'

export interface LogStreamProps {
  lines: string[]
  height?: number
  title?: string
}

function colorFor(line: string): string {
  const l = line.toLowerCase()
  if (l.includes('error') || l.includes('failed')) return 'red'
  if (l.includes('done') || l.includes('completed') || l.includes('success')) return 'green'
  if (l.includes('starting') || l.includes('running') || l.includes('judging')) return 'cyan'
  if (l.includes('warning') || l.includes('warn')) return 'yellow'
  return theme.text
}

export function LogStream({ lines, height = 12, title }: LogStreamProps) {
  const tail = lines.slice(-height)

  return (
    <Box flexDirection="column">
      {title && <Text color={theme.muted} bold>{title}</Text>}
      {tail.length === 0 && <Text color={theme.muted}>  (no output yet)</Text>}
      {tail.map((line, i) => (
        <Text key={i} color={colorFor(line)}>{' '}{line.slice(0, 200)}</Text>
      ))}
    </Box>
  )
}
