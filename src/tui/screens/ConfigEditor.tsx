/**
 * Config Editor — Phase 2 MVP.
 *
 * Shows a read-only structured view of verdict.yaml (models, judge, run).
 * Press `E` to shell out to $EDITOR on the YAML file; re-validates via Zod
 * on return. Full Zod-form editing is Phase 3.
 */

import { useEffect, useState } from 'react'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { Box, Text, useInput, useApp } from 'ink'
import { theme } from '../theme.js'
import { useConfig } from '../hooks/useConfig.js'
import { loadConfig } from '../../core/config.js'
import type { Config } from '../../types/index.js'

export interface ConfigEditorProps {
  onBack?: () => void
}

export function ConfigEditor(_props: ConfigEditorProps) {
  const { config: initial, error } = useConfig('./verdict.yaml')
  const [config, setConfig] = useState<Config | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)
  const { exit: _exit } = useApp()

  useEffect(() => { if (initial) setConfig(initial) }, [initial])

  const reload = () => {
    try {
      const next = loadConfig(path.resolve('./verdict.yaml'))
      setConfig(next)
      setToast('Reloaded — config valid')
    } catch (e) {
      setToast(`Invalid config: ${(e as Error).message.slice(0, 80)}`)
    }
  }

  useInput((input) => {
    if (input === 'r') reload()
    if (input === 'E' || input === 'e') launchEditor()
  })

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const launchEditor = () => {
    const editor = process.env['EDITOR'] || process.env['VISUAL'] || 'vi'
    const file = path.resolve('./verdict.yaml')
    if (!fs.existsSync(file)) {
      setToast(`verdict.yaml not found at ${file}`)
      return
    }
    setReloading(true)
    // Spawn synchronously-ish: detach from Ink's stdin, wait, then reload
    const child = spawn(editor, [file], { stdio: 'inherit' })
    child.on('exit', () => {
      setReloading(false)
      reload()
    })
    child.on('error', (err) => {
      setReloading(false)
      setToast(`Could not launch ${editor}: ${err.message}`)
    })
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color={theme.danger}>Config error</Text>
        <Text color={theme.muted}>{error}</Text>
        <Text color={theme.muted}>{'\n'}Press E to open $EDITOR and fix it</Text>
      </Box>
    )
  }

  if (!config) {
    return <Text color={theme.muted}>Loading verdict.yaml…</Text>
  }

  if (reloading) {
    return <Text color={theme.primary}>Editor is open — save and quit to return.</Text>
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>🧰 Config  </Text>
        <Text color={theme.muted}>./verdict.yaml · E: edit in $EDITOR · r: reload</Text>
      </Box>

      <Text color={theme.accent} bold>name</Text>
      <Text>  {config.name}</Text>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.accent} bold>models ({config.models.length})</Text>
        {config.models.map(m => (
          <Box key={m.id}>
            <Text color={theme.text}>  • {m.id.padEnd(24).slice(0, 24)} </Text>
            <Text color={theme.muted}>{(m.provider ?? 'compat').padEnd(9)}</Text>
            <Text>{m.model.padEnd(28).slice(0, 28)} </Text>
            <Text color={theme.muted}>max_tokens {m.max_tokens}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.accent} bold>judge</Text>
        <Text>  model:    <Text color={theme.text}>{config.judge.model}</Text></Text>
        <Text>  blind:    <Text color={theme.text}>{String(config.judge.blind)}</Text></Text>
        <Text>  strategy: <Text color={theme.text}>{config.judge.strategy}</Text></Text>
        <Text>  rubric:   <Text color={theme.muted}>
          a={config.judge.rubric.accuracy} c={config.judge.rubric.completeness} b={config.judge.rubric.conciseness}
        </Text></Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.accent} bold>run</Text>
        <Text>  concurrency: <Text color={theme.text}>{config.run.concurrency}</Text></Text>
        <Text>  retries:     <Text color={theme.text}>{config.run.retries}</Text></Text>
        <Text>  cache:       <Text color={theme.text}>{String(config.run.cache)}</Text></Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.accent} bold>output</Text>
        <Text>  dir:     <Text color={theme.text}>{config.output.dir}</Text></Text>
        <Text>  formats: <Text color={theme.text}>{config.output.formats.join(', ')}</Text></Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.accent} bold>packs ({config.packs.length})</Text>
        {config.packs.map(p => <Text key={p}>  • {p}</Text>)}
      </Box>

      {toast && (
        <Box marginTop={1}>
          <Text color={theme.highlight}>» {toast}</Text>
        </Box>
      )}
    </Box>
  )
}
