/**
 * Top-to-bottom app chrome: header with the current screen + keybind footer
 * + ephemeral toast line.
 */

import { Box, Text } from 'ink'
import { theme, getThemeName } from '../theme.js'
import type { Screen, Mode } from '../hooks/useKeymap.js'

export interface LayoutProps {
  screen: Screen
  mode: Mode
  title?: string
  children: React.ReactNode
  footerHints?: [string, string][]
  toast?: string | null
}

const SCREEN_NAMES: Record<Screen, string> = {
  'home':       '1 Home',
  'runs':       '2 Runs',
  'models':     '3 Models',
  'baselines':  '4 Baselines',
  'daemon':     '5 Daemon',
  'eval-packs': '6 Packs',
  'run-detail': 'Run Detail',
  'live-run':   'Live Run',
  'new-run':    'New Run',
  'compare':    'Compare',
  'config':     'Config',
  'router':     'Router',
  'serve':      'Serve',
}

export function Layout({ screen, mode, title, children, footerHints, toast }: LayoutProps) {
  const tabs: Screen[] = ['home', 'runs', 'models', 'baselines', 'daemon', 'eval-packs']
  const globalHints: [string, string][] = [
    [':', 'cmd'],
    ['/', 'filter'],
    ['?', 'help'],
    ['t', 'theme'],
    ['^o', 'back'],
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
        <Text color={theme.muted} dimColor>{getThemeName()}</Text>
      </Box>

      {/* Body */}
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {children}
      </Box>

      {/* Toast line (only when present, above the footer) */}
      {toast && (
        <Box paddingX={1}>
          <Text color={theme.highlight}>» {toast}</Text>
        </Box>
      )}

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
