/**
 * NewRun wizard — customize which models + packs to run, then launch.
 *
 * Two panes:
 *   1. Models  — space to toggle, all on by default
 *   2. Packs   — space to toggle, all on by default
 * Tab moves between panes, Enter launches.
 */

import { useEffect, useMemo, useState } from 'react'
import path from 'path'
import { Box, Text, useInput } from 'ink'
import { Spinner } from '@inkjs/ui'
import { theme, scoreColor } from '../theme.js'
import { useConfig } from '../hooks/useConfig.js'
import { useLiveRun } from '../hooks/useLiveRun.js'
import { loadEvalPack } from '../../core/config.js'
import { LogStream } from '../components/LogStream.js'
import type { EvalPack } from '../../types/index.js'

export interface NewRunProps {
  onBack?: () => void
}

type Pane = 'models' | 'packs'

export function NewRun(_props: NewRunProps) {
  const { config, error: cfgErr } = useConfig('./verdict.yaml')
  const { state, start } = useLiveRun()

  const [pane, setPane] = useState<Pane>('models')
  const [modelIdx, setModelIdx] = useState(0)
  const [packIdx, setPackIdx] = useState(0)
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(new Set())
  const [loadedPacks, setLoadedPacks] = useState<Array<{ path: string, pack: EvalPack | null, err?: string }>>([])

  // Initialize selection sets from config
  useEffect(() => {
    if (!config) return
    setSelectedModels(new Set(config.models.map(m => m.id)))
    setSelectedPacks(new Set(config.packs))
    const configDir = path.dirname(path.resolve('./verdict.yaml'))
    setLoadedPacks(config.packs.map(p => {
      try { return { path: p, pack: loadEvalPack(p, configDir) } }
      catch (e) { return { path: p, pack: null, err: (e as Error).message } }
    }))
  }, [config])

  const launching = state.phase === 'running' || state.phase === 'done' || state.phase === 'error'

  useInput((input, key) => {
    if (launching) return
    if (key.tab) {
      setPane(p => p === 'models' ? 'packs' : 'models')
      return
    }
    const items = pane === 'models'
      ? (config?.models ?? [])
      : loadedPacks
    const idx = pane === 'models' ? modelIdx : packIdx
    const setIdx = pane === 'models' ? setModelIdx : setPackIdx

    if (input === 'j' || key.downArrow) setIdx(Math.min(idx + 1, items.length - 1))
    else if (input === 'k' || key.upArrow) setIdx(Math.max(idx - 1, 0))
    else if (input === ' ') {
      const current = pane === 'models'
        ? (config?.models[idx]?.id ?? '')
        : (loadedPacks[idx]?.path ?? '')
      if (!current) return
      const set = pane === 'models' ? new Set(selectedModels) : new Set(selectedPacks)
      if (set.has(current)) set.delete(current)
      else set.add(current)
      if (pane === 'models') setSelectedModels(set)
      else setSelectedPacks(set)
    }
    else if (key.return) {
      if (!config) return
      const newConfig = {
        ...config,
        models: config.models.filter(m => selectedModels.has(m.id)),
      }
      const packs = loadedPacks
        .filter(lp => selectedPacks.has(lp.path) && lp.pack)
        .map(lp => lp.pack!) as EvalPack[]
      if (newConfig.models.length === 0) return
      if (packs.length === 0) return
      start({ config: newConfig, packs })
    }
  })

  if (cfgErr) {
    return (
      <Box flexDirection="column">
        <Text color={theme.danger}>Config error</Text>
        <Text color={theme.muted}>{cfgErr}</Text>
      </Box>
    )
  }

  if (launching) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color={theme.accent} bold>▶ Run  </Text>
          <Text color={theme.muted}>
            {selectedModels.size} model{selectedModels.size === 1 ? '' : 's'} ·{' '}
            {selectedPacks.size} pack{selectedPacks.size === 1 ? '' : 's'}
          </Text>
        </Box>
        {state.phase === 'running' && (
          <Box><Spinner /><Text color={theme.primary}> {state.current || 'starting…'}</Text></Box>
        )}
        {state.phase === 'done' && (
          <Text color={theme.success} bold>✓ Done.</Text>
        )}
        {state.phase === 'error' && (
          <Text color={theme.danger}>✗ {state.error}</Text>
        )}
        <Box marginTop={1}><LogStream lines={state.log} height={14} title="progress" /></Box>
        {state.result && (
          <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor={theme.borderDim} paddingX={1}>
            <Text color={theme.accent} bold>Summary</Text>
            {Object.values(state.result.summary)
              .sort((a, b) => b.avg_total - a.avg_total)
              .slice(0, 6)
              .map((s, i) => (
                <Box key={s.model_id}>
                  <Text color={theme.muted}>{String(i + 1).padStart(2)}. </Text>
                  <Text>{s.model_id.padEnd(28).slice(0, 28)} </Text>
                  <Text color={scoreColor(s.avg_total)} bold>{s.avg_total.toFixed(2).padStart(5)}</Text>
                </Box>
              ))}
          </Box>
        )}
      </Box>
    )
  }

  const models = config?.models ?? []

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>🛠  New run  </Text>
        <Text color={theme.muted}>Tab: switch pane · Space: toggle · Enter: launch</Text>
      </Box>

      <Box flexDirection="column">
        <Text color={pane === 'models' ? theme.highlight : theme.muted} bold>Models</Text>
        {models.length === 0 && <Text color={theme.muted}>  (none)</Text>}
        {models.map((m, i) => {
          const active = pane === 'models' && i === modelIdx
          const checked = selectedModels.has(m.id)
          return (
            <Box key={m.id}>
              <Text color={active ? theme.highlight : theme.text} inverse={active}>
                {' '}[{checked ? <Text color={theme.success}>x</Text> : ' '}] {m.id.padEnd(34).slice(0, 34)} {m.model}
              </Text>
            </Box>
          )
        })}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={pane === 'packs' ? theme.highlight : theme.muted} bold>Packs</Text>
        {loadedPacks.length === 0 && <Text color={theme.muted}>  (none)</Text>}
        {loadedPacks.map((lp, i) => {
          const active = pane === 'packs' && i === packIdx
          const checked = selectedPacks.has(lp.path)
          return (
            <Box key={lp.path}>
              <Text color={active ? theme.highlight : theme.text} inverse={active}>
                {' '}[{checked ? <Text color={theme.success}>x</Text> : ' '}] {lp.path.padEnd(40).slice(0, 40)}
              </Text>
              {lp.pack && <Text color={theme.muted}>  {lp.pack.cases.length} cases</Text>}
              {lp.err && <Text color={theme.danger}>  {lp.err.slice(0, 30)}</Text>}
            </Box>
          )
        })}
      </Box>

      <Box marginTop={1}>
        {selectedModels.size === 0 && <Text color={theme.warning}>⚠ select at least one model  </Text>}
        {selectedPacks.size === 0 && <Text color={theme.warning}>⚠ select at least one pack  </Text>}
        {selectedModels.size > 0 && selectedPacks.size > 0 && (
          <Text color={theme.muted}>Press <Text color={theme.highlight}>Enter</Text> to launch</Text>
        )}
      </Box>
    </Box>
  )
}
