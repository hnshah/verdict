/**
 * Top-to-bottom app chrome: header with the current screen + keybind footer.
 */

import { Box, Text } from 'ink'
import { theme } from '../theme.js'
import type { Screen, Mode } from '../hooks/useKeymap.js'

export interface LayoutProps {
  screen: Screen
  mode: Mode
  title?: string
  children: React.ReactNode
  footerHints?: [string, string][]
}

const SCREEN_NAMES: Record<Screen, string> = {
  'home':       '1 Home',
  'runs':       '2 Runs',
  'models':     '3 Models',
  'run-detail': 'Run Detail',
  'live-run':   'Live Run',
}

export function Layout({ screen, mode, title, children, footerHints }: LayoutProps) {
  const tabs: Screen[] = ['home', 'runs', 'models']
  const globalHints: [string, string][] = [
    [':', 'cmd'],
    ['/', 'filter'],
    ['?', 'help'],
    ['q', 'quit'],
  ]
  const hints = [...(footerHints ?? []), ...globalHints]

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="round" borderColor={theme.border} paddingX={1}>
        <Text color={theme.primary} bold>verdict </Text>
        <Text color={theme.muted}>│ </Text>
        {tabs.map(t => (
          <Text
            key={t}
            color={t === screen ? theme.highlight : theme.muted}
            bold={t === screen}
          >
            {SCREEN_NAMES[t]}  </Text>
        ))}
        <Text color={theme.muted}>│ </Text>
        <Text color={theme.accent}>{title ?? SCREEN_NAMES[screen]}</Text>
        <Box flexGrow={1}><Text> </Text></Box>
        <Text color={theme.muted}>[{mode}] </Text>
      </Box>

      {/* Body */}
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {children}
      </Box>

      {/* Footer */}
      <Box borderStyle="single" borderColor={theme.borderDim} paddingX={1}>
        {hints.map(([k, v], i) => (
          <Text key={i}>
            <Text color={theme.highlight}>{k}</Text>
            <Text color={theme.muted}>:{v}  </Text>
          </Text>
        ))}
      </Box>
    </Box>
  )
}
