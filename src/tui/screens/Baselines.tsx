/**
 * Baselines screen — list saved baselines, save the latest result, or diff
 * the current latest result against a selected baseline.
 *
 * Reuses src/core/baseline.ts API:
 *   listBaselines(), loadBaseline(), saveBaseline(), compareWithBaseline(),
 *   findLatestResult()
 */

import { useEffect, useMemo, useState } from 'react'
import fs from 'fs'
import { Box, Text, useInput } from 'ink'
import { theme } from '../theme.js'
import { Table, type Column } from '../components/Table.js'
import { DiffPane } from '../components/DiffPane.js'
import {
  listBaselines,
  loadBaseline,
  saveBaseline,
  compareWithBaseline,
  findLatestResult,
  type BaselineInfo,
} from '../../core/baseline.js'
import { useConfig } from '../hooks/useConfig.js'
import type { BaselineComparison, RunResult } from '../../types/index.js'

export interface BaselinesProps {
  onBack?: () => void
}

type Mode = 'list' | 'save-prompt' | 'diff'

export function Baselines(_props: BaselinesProps) {
  const { config } = useConfig('./verdict.yaml')
  const [baselines, setBaselines] = useState<BaselineInfo[]>([])
  const [selected, setSelected] = useState<BaselineInfo | null>(null)
  const [comparison, setComparison] = useState<BaselineComparison | null>(null)
  const [mode, setMode] = useState<Mode>('list')
  const [saveName, setSaveName] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const refresh = () => setBaselines(listBaselines())

  useEffect(() => { refresh() }, [])

  const latestPath = useMemo(
    () => config ? findLatestResult(config.output.dir) : null,
    [config]
  )

  useInput((input, key) => {
    if (mode === 'save-prompt') {
      if (key.escape) { setMode('list'); setSaveName(''); return }
      if (key.return) {
        if (!saveName.trim() || !latestPath) { setMode('list'); return }
        try {
          saveBaseline(saveName.trim(), latestPath)
          setToast(`Saved baseline "${saveName.trim()}"`)
          refresh()
        } catch (e) {
          setToast(`Save failed: ${(e as Error).message}`)
        }
        setSaveName('')
        setMode('list')
        return
      }
      if (key.backspace || key.delete) { setSaveName(n => n.slice(0, -1)); return }
      if (input && !key.ctrl && !key.meta) setSaveName(n => n + input)
      return
    }

    if (mode === 'diff') {
      if (key.escape) { setComparison(null); setMode('list'); return }
      return
    }

    if (input === 's') {
      if (!latestPath) {
        setToast('No latest result to save — run an eval first')
        return
      }
      setSaveName('')
      setMode('save-prompt')
      return
    }
    if (input === 'r') refresh()
  })

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const openDiff = (b: BaselineInfo) => {
    if (!latestPath) { setToast('No latest result — run an eval first'); return }
    const baseline = loadBaseline(b.name)
    if (!baseline) { setToast(`Could not load baseline ${b.name}`); return }
    try {
      const current = JSON.parse(fs.readFileSync(latestPath, 'utf8')) as RunResult
      setComparison(compareWithBaseline(baseline, current, b.name))
      setSelected(b)
      setMode('diff')
    } catch (e) {
      setToast(`Could not load latest result: ${(e as Error).message}`)
    }
  }

  const columns: Column<BaselineInfo>[] = [
    { key: 'name',   header: 'NAME',   width: 22, render: b => b.name },
    { key: 'date',   header: 'SAVED',  width: 20, render: b => b.date },
    { key: 'models', header: 'MODELS', width: 7, align: 'right', render: b => String(b.modelCount) },
    { key: 'cases',  header: 'CASES',  width: 6, align: 'right', render: b => String(b.caseCount) },
  ]

  if (mode === 'diff' && comparison) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text color={theme.accent} bold>⚖  Diff: latest vs {comparison.baselineName}</Text>
          <Text color={theme.muted}>baseline saved {comparison.baselineDate}  ·  Esc to go back</Text>
        </Box>
        <DiffPane comparison={comparison} nameA={comparison.baselineName} nameB="latest" />
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>📌 Baselines  </Text>
        <Text color={theme.muted}>s: save latest · Enter: diff · r: refresh</Text>
      </Box>

      {!latestPath && (
        <Text color={theme.warning}>  No latest result found in {config?.output.dir ?? 'output dir'}</Text>
      )}

      <Table
        rows={baselines}
        columns={columns}
        height={10}
        onEnter={openDiff}
        onSelectionChange={(b) => setSelected(b)}
        emptyMessage="No baselines saved yet. Press s to save the latest run as a baseline."
      />

      {mode === 'save-prompt' && (
        <Box marginTop={1} borderStyle="single" borderColor={theme.accent} paddingX={1}>
          <Text color={theme.accent}>Name: </Text>
          <Text>{saveName}</Text>
          <Text color={theme.muted}>▏ (Enter to save, Esc to cancel)</Text>
        </Box>
      )}

      {selected && mode === 'list' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.muted}>─ selected ──────</Text>
          <Text>name: <Text color={theme.text}>{selected.name}</Text></Text>
        </Box>
      )}

      {toast && (
        <Box marginTop={1}>
          <Text color={theme.highlight}>» {toast}</Text>
        </Box>
      )}
    </Box>
  )
}
