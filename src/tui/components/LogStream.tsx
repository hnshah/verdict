/**
 * Auto-scrolling log pane with pause support.
 *
 * Default: shows the tail. If `paused` is true, shows the snapshot captured
 * at pause time (the parent should save & pass it — see Daemon screen).
 */

import { Box, Text } from 'ink'
import { theme } from '../theme.js'

export interface LogStreamProps {
  lines: string[]
  height?: number
  title?: string
  paused?: boolean
}

function colorFor(line: string): string {
  const l = line.toLowerCase()
  if (l.includes('error') || l.includes('failed')) return 'red'
  if (l.includes('done') || l.includes('completed') || l.includes('success')) return 'green'
  if (l.includes('starting') || l.includes('running') || l.includes('judging')) return 'cyan'
  if (l.includes('warning') || l.includes('warn')) return 'yellow'
  return theme.text
}

export function LogStream({ lines, height = 12, title, paused }: LogStreamProps) {
  const tail = lines.slice(-height)

  return (
    <Box flexDirection="column">
      {(title || paused) && (
        <Box>
          {title && <Text color={theme.muted} bold>{title}  </Text>}
          {paused && <Text color={theme.warning}>[PAUSED]</Text>}
        </Box>
      )}
      {tail.length === 0 && <Text color={theme.muted}>  (no output yet)</Text>}
      {tail.map((line, i) => (
        <Text key={i} color={colorFor(line)}>{' '}{line.slice(0, 200)}</Text>
      ))}
    </Box>
  )
}
