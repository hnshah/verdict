/**
 * Modal command palette, opened with ':' (see useKeymap).
 * Fuzzy matches over a static command list using Fuse.js.
 */

import { useMemo, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import Fuse from 'fuse.js'
import { theme } from '../theme.js'
import { Clickable } from './Clickable.js'
import type { Screen } from '../hooks/useKeymap.js'

export interface Command {
  id: string
  label: string
  hint?: string
  action: () => void
}

export interface PaletteProps {
  commands: Command[]
  onClose: () => void
}

export function Palette({ commands, onClose }: PaletteProps) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const fuse = useMemo(
    () => new Fuse(commands, { keys: ['label', 'id'], threshold: 0.4 }),
    [commands]
  )
  const results = query
    ? fuse.search(query).map(r => r.item).slice(0, 10)
    : commands.slice(0, 10)

  useInput((input, key) => {
    if (key.escape) { onClose(); return }
    if (key.return) {
      const cmd = results[cursor]
      if (cmd) { cmd.action(); onClose() }
      return
    }
    if (key.downArrow || (key.ctrl && input === 'n')) {
      setCursor(c => Math.min(c + 1, results.length - 1))
      return
    }
    if (key.upArrow || (key.ctrl && input === 'p')) {
      setCursor(c => Math.max(c - 1, 0))
      return
    }
    if (key.backspace || key.delete) {
      setQuery(q => q.slice(0, -1))
      setCursor(0)
      return
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery(q => q + input)
      setCursor(0)
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.accent}
      paddingX={1}
      width={60}
    >
      <Box>
        <Text color={theme.accent} bold>: </Text>
        <Text>{query}</Text>
        <Text color={theme.muted}>▏</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {results.length === 0 && (
          <Text color={theme.muted}>  No matching commands</Text>
        )}
        {results.map((cmd, i) => {
          const selected = i === cursor
          return (
            <Clickable
              key={cmd.id}
              onClick={() => { cmd.action(); onClose() }}
            >
              <Box>
                <Text color={selected ? theme.highlight : theme.text} inverse={selected}>
                  {' '}{cmd.label.padEnd(30)}
                </Text>
                {cmd.hint && (
                  <Text color={theme.muted} dimColor>{' '}{cmd.hint}</Text>
                )}
              </Box>
            </Clickable>
          )
        })}
      </Box>
    </Box>
  )
}

/** Build the default command list given a dispatch. Used by App. */
export function defaultCommands(goto: (s: Screen) => void): Command[] {
  return [
    { id: 'goto:home',      label: 'Go to Home',        hint: '1', action: () => goto('home') },
    { id: 'goto:runs',      label: 'Go to Runs',        hint: '2', action: () => goto('runs') },
    { id: 'goto:models',    label: 'Go to Models',      hint: '3', action: () => goto('models') },
    { id: 'goto:baselines', label: 'Go to Baselines',   hint: '4', action: () => goto('baselines') },
    { id: 'goto:daemon',    label: 'Go to Daemon',      hint: '5', action: () => goto('daemon') },
    { id: 'goto:packs',     label: 'Go to Eval Packs',  hint: '6', action: () => goto('eval-packs') },
    { id: 'goto:compare',   label: 'Compare two runs',  hint: 'Pick A vs B', action: () => goto('compare') },
    { id: 'goto:config',    label: 'Open Config',       hint: 'verdict.yaml view + $EDITOR', action: () => goto('config') },
    { id: 'goto:new-run',   label: 'New Run (custom)',  hint: 'Pick models + packs', action: () => goto('new-run') },
    { id: 'goto:live',      label: 'Quick Live Run',    hint: 'All models, all packs', action: () => goto('live-run') },
    { id: 'goto:router',    label: 'Router',            hint: 'Route a prompt to best model', action: () => goto('router') },
    { id: 'goto:serve',     label: 'Serve proxy',       hint: 'OpenAI-compat HTTP server', action: () => goto('serve') },
  ]
}
