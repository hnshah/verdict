/**
 * Compare screen — pick two run result files from the config.output.dir and
 * render a side-by-side diff via DiffPane.
 *
 * Flow: list result files → select A (Enter) → list again → select B (Enter)
 *       → DiffPane. Esc at any point backs out.
 */

import { useEffect, useMemo, useState } from 'react'
import fs from 'fs'
import path from 'path'
import { Box, Text, useInput } from 'ink'
import { theme } from '../theme.js'
import { Table, type Column } from '../components/Table.js'
import { DiffPane } from '../components/DiffPane.js'
import { compareWithBaseline } from '../../core/baseline.js'
import { useConfig } from '../hooks/useConfig.js'
import type { BaselineComparison, RunResult } from '../../types/index.js'

export interface CompareProps {
  onBack?: () => void
}

interface ResultFile {
  name: string
  path: string
  mtime: number
}

function listResults(outputDir: string): ResultFile[] {
  const dir = path.resolve(outputDir)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.startsWith('.'))
    .map(f => {
      const full = path.join(dir, f)
      let mtime = 0
      try { mtime = fs.statSync(full).mtimeMs } catch {}
      return { name: f, path: full, mtime }
    })
    .sort((a, b) => b.mtime - a.mtime)
}

type Stage = 'pick-a' | 'pick-b' | 'diff'

export function Compare(_props: CompareProps) {
  const { config } = useConfig('./verdict.yaml')
  const [stage, setStage] = useState<Stage>('pick-a')
  const [fileA, setFileA] = useState<ResultFile | null>(null)
  const [fileB, setFileB] = useState<ResultFile | null>(null)
  const [comparison, setComparison] = useState<BaselineComparison | null>(null)
  const [error, setError] = useState<string | null>(null)

  const files = useMemo(
    () => config ? listResults(config.output.dir) : [],
    [config]
  )

  useEffect(() => {
    if (stage === 'diff' && fileA && fileB) {
      try {
        const a = JSON.parse(fs.readFileSync(fileA.path, 'utf8')) as RunResult
        const b = JSON.parse(fs.readFileSync(fileB.path, 'utf8')) as RunResult
        setComparison(compareWithBaseline(a, b, fileA.name))
      } catch (e) {
        setError((e as Error).message)
        setStage('pick-a')
      }
    }
  }, [stage, fileA, fileB])

  useInput((_, key) => {
    if (key.escape) {
      if (stage === 'diff') { setStage('pick-b'); setComparison(null) }
      else if (stage === 'pick-b') { setStage('pick-a'); setFileB(null) }
    }
  })

  const columns: Column<ResultFile>[] = [
    { key: 'name',  header: 'FILE',     width: 40, render: f => f.name },
    { key: 'mtime', header: 'MODIFIED', width: 19,
      render: f => new Date(f.mtime).toISOString().slice(0, 19).replace('T', ' ') },
  ]

  if (stage === 'diff' && comparison && fileA && fileB) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text color={theme.accent} bold>⚖  Compare</Text>
          <Text color={theme.muted}>A: {fileA.name}</Text>
          <Text color={theme.muted}>B: {fileB.name}</Text>
          <Text color={theme.muted}>Esc to go back</Text>
        </Box>
        <DiffPane comparison={comparison} nameA="A" nameB="B" />
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>⚖  Compare  </Text>
        <Text color={theme.muted}>
          {stage === 'pick-a' ? 'Pick result A (Enter)' : `A = ${fileA?.name}  ·  Pick result B (Enter)`}
        </Text>
      </Box>

      {error && <Text color={theme.danger}>  {error}</Text>}

      <Table
        rows={files}
        columns={columns}
        height={16}
        onEnter={(f) => {
          if (stage === 'pick-a') { setFileA(f); setStage('pick-b') }
          else if (stage === 'pick-b') {
            if (fileA && f.path === fileA.path) {
              setError('Pick a different file for B')
              return
            }
            setFileB(f); setStage('diff')
          }
        }}
        emptyMessage={config ? `No result JSONs in ${config.output.dir}` : 'Load config first'}
      />
    </Box>
  )
}
