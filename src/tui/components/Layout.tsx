/**
 * Top-to-bottom app chrome: header with the current screen + keybind footer
 * + ephemeral toast line.
 *
 * Two responsive modes:
 *   - wide   (≥ 100 cols): full tab labels, all footer hints visible
 *   - narrow (< 100 cols): single-digit tab labels, compact footer
 */

import { useEffect, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import { theme, getThemeName } from '../theme.js'
import { Clickable } from './Clickable.js'
import type { Screen, Mode } from '../hooks/useKeymap.js'

export interface LayoutProps {
  screen: Screen
  mode: Mode
  title?: string
  children: React.ReactNode
  footerHints?: [string, string][]
  toast?: string | null
  onTabClick?: (screen: Screen) => void
}

const SCREEN_NAMES: Record<Screen, string> = {
  'home':       '1 Home',
  'runs':       '2 Runs',
  'models':     '3 Models',
  'baselines':  '4 Baselines',
  'daemon':     '5 Daemon',
  'eval-packs': '6 Packs',
  'schedules':  '7 Schedules',
  'run-detail': 'Run Detail',
  'live-run':   'Live Run',
  'new-run':    'New Run',
  'compare':    'Compare',
  'config':     'Config',
  'router':     'Router',
  'serve':      'Serve',
}

const SHORT_NAMES: Record<Screen, string> = {
  'home':       '1 Hm',
  'runs':       '2 Rn',
  'models':     '3 Mo',
  'baselines':  '4 Bs',
  'daemon':     '5 Dm',
  'eval-packs': '6 Pk',
  'schedules':  '7 Sc',
  'run-detail': 'Det',
  'live-run':   'Live',
  'new-run':    'New',
  'compare':    'Cmp',
  'config':     'Cfg',
  'router':     'Rtr',
  'serve':      'Srv',
}

function useTerminalWidth(): number {
  const { stdout } = useStdout()
  const [width, setWidth] = useState(stdout?.columns ?? 120)
  useEffect(() => {
    if (!stdout) return
    const onResize = () => setWidth(stdout.columns ?? 120)
    stdout.on('resize', onResize)
    return () => { stdout.off('resize', onResize) }
  }, [stdout])
  return width
}

export function Layout({ screen, mode, title, children, footerHints, toast, onTabClick }: LayoutProps) {
  const cols = useTerminalWidth()
  const narrow = cols < 100
  const names = narrow ? SHORT_NAMES : SCREEN_NAMES

  const tabs: Screen[] = ['home', 'runs', 'models', 'baselines', 'daemon', 'eval-packs', 'schedules']

  const fullHints: [string, string][] = [
    [':', 'cmd'],
    ['/', 'filter'],
    ['?', 'help'],
    ['t', 'theme'],
    ['^o', 'back'],
    ['q', 'quit'],
  ]
  const narrowHints: [string, string][] = [
    [':', 'cmd'],
    ['/', 'flt'],
    ['?', 'help'],
    ['q', 'quit'],
  ]
  const hints = [...(footerHints ?? []), ...(narrow ? narrowHints : fullHints)]

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="round" borderColor={theme.border} paddingX={1}>
        <Text color={theme.primary} bold>verdict </Text>
        <Text color={theme.muted}>│ </Text>
        {tabs.map(t => {
          const label = names[t]
          const active = t === screen
          return onTabClick ? (
            <Clickable key={t} onClick={() => onTabClick(t)}>
              <Text color={active ? theme.highlight : theme.muted} bold={active}>
                {label}  </Text>
            </Clickable>
          ) : (
            <Text key={t} color={active ? theme.highlight : theme.muted} bold={active}>
              {label}  </Text>
          )
        })}
        {!narrow && (
          <>
            <Text color={theme.muted}>│ </Text>
            <Text color={theme.accent}>{title ?? SCREEN_NAMES[screen]}</Text>
          </>
        )}
        <Box flexGrow={1}><Text> </Text></Box>
        <Text color={theme.muted}>[{mode}] </Text>
        {!narrow && <Text color={theme.muted} dimColor>{getThemeName()}</Text>}
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
