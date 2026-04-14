/**
 * '?' help overlay. Lists global + screen-local keybinds.
 */

import { Box, Text, useInput } from 'ink'
import { theme } from '../theme.js'

export interface HelpOverlayProps {
  screen: string
  onClose: () => void
}

const GLOBAL = [
  [':',       'Command palette'],
  ['/',       'Filter visible list'],
  ['?',       'Toggle this help'],
  ['q',       'Quit'],
  ['Esc',     'Cancel / back to normal mode'],
  ['Tab',     'Next pane'],
  ['1/2/3',   'Jump to Home / Runs / Models'],
]

const SCREEN_KEYS: Record<string, string[][]> = {
  home: [
    ['Enter',   'Open selected run'],
  ],
  runs: [
    ['j/k',     'Next / prev row'],
    ['g/G',     'Top / bottom'],
    ['Enter',   'Open run detail'],
    ['n',       'Start a new live run'],
  ],
  'run-detail': [
    ['j/k',     'Next / prev case'],
    ['d',       'Diff against baseline (Phase 2)'],
  ],
  'live-run': [
    ['Ctrl-C',  'Abort run (checkpoint preserved)'],
    ['s',       'Save as baseline (when done)'],
  ],
  models: [
    ['d',       'Discover local models (Ollama/MLX/LM Studio)'],
    ['r',       'Refresh list'],
  ],
}

export function HelpOverlay({ screen, onClose }: HelpOverlayProps) {
  useInput((_, key) => {
    if (key.escape || key.return) onClose()
  })

  const screenKeys = SCREEN_KEYS[screen] ?? []

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.accent}
      paddingX={2}
      paddingY={1}
      width={60}
    >
      <Text color={theme.accent} bold>Keybinds — global</Text>
      <Box flexDirection="column" marginTop={1}>
        {GLOBAL.map(([k, v]) => (
          <Box key={k}>
            <Text color={theme.highlight}>{k.padEnd(10)}</Text>
            <Text color={theme.text}>{v}</Text>
          </Box>
        ))}
      </Box>
      {screenKeys.length > 0 && (
        <>
          <Text color={theme.accent} bold>{'\n'}{screen}</Text>
          <Box flexDirection="column" marginTop={1}>
            {screenKeys.map(([k, v]) => (
              <Box key={k}>
                <Text color={theme.highlight}>{k.padEnd(10)}</Text>
                <Text color={theme.text}>{v}</Text>
              </Box>
            ))}
          </Box>
        </>
      )}
      <Text color={theme.muted} dimColor>{'\n'}Press Esc or Enter to close</Text>
    </Box>
  )
}
