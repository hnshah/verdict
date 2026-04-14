/**
 * EvalPacks browser — lists *.yaml files in ./eval-packs/ (and a few common
 * neighbors), loads each via loadEvalPack, lets the user browse cases.
 *
 * Two panes: pack list on the left, selected-pack case list on the right.
 */

import { useEffect, useMemo, useState } from 'react'
import fs from 'fs'
import path from 'path'
import { Box, Text } from 'ink'
import { theme } from '../theme.js'
import { Table, type Column } from '../components/Table.js'
import { loadEvalPack } from '../../core/config.js'
import type { EvalPack, EvalCase } from '../../types/index.js'

export interface EvalPacksProps {
  onBack?: () => void
}

interface PackEntry {
  file: string
  path: string
  pack: EvalPack | null
  error?: string
}

const PACK_DIRS = ['./eval-packs', './multimodal-evals']

function listPacks(): PackEntry[] {
  const entries: PackEntry[] = []
  for (const rel of PACK_DIRS) {
    const dir = path.resolve(rel)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.yaml') && !f.endsWith('.yml')) continue
      const full = path.join(dir, f)
      try {
        const pack = loadEvalPack(full, path.dirname(full))
        entries.push({ file: path.relative(process.cwd(), full), path: full, pack })
      } catch (e) {
        entries.push({ file: path.relative(process.cwd(), full), path: full, pack: null, error: (e as Error).message })
      }
    }
  }
  return entries.sort((a, b) => a.file.localeCompare(b.file))
}

export function EvalPacks(_props: EvalPacksProps) {
  const [entries, setEntries] = useState<PackEntry[]>([])
  const [selected, setSelected] = useState<PackEntry | null>(null)
  const [selectedCase, setSelectedCase] = useState<EvalCase | null>(null)

  useEffect(() => { setEntries(listPacks()) }, [])

  const packCols: Column<PackEntry>[] = [
    { key: 'file', header: 'FILE', width: 38,
      render: p => p.file.replace(/^eval-packs\//, ''),
      color: p => p.error ? theme.danger : undefined },
    { key: 'name', header: 'NAME', width: 22, render: p => p.pack?.name ?? '—' },
    { key: 'cases', header: 'CASES', width: 6, align: 'right',
      render: p => String(p.pack?.cases.length ?? 0) },
  ]

  const caseCols: Column<EvalCase>[] = useMemo(() => [
    { key: 'id', header: 'ID', width: 22, render: c => c.id },
    { key: 'scorer', header: 'SCORER', width: 10, render: c => c.scorer },
    { key: 'prompt', header: 'PROMPT', width: 36,
      render: c => c.prompt.slice(0, 34).replace(/\n/g, ' ') },
  ], [])

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>📦 Eval packs  </Text>
        <Text color={theme.muted}>({entries.length} loaded · Enter to browse cases)</Text>
      </Box>
      <Table
        rows={entries}
        columns={packCols}
        height={8}
        onSelectionChange={(p) => { setSelected(p); setSelectedCase(null) }}
        emptyMessage="No eval packs found in ./eval-packs/"
      />
      {selected?.error && (
        <Text color={theme.danger}>  parse error: {selected.error}</Text>
      )}
      {selected?.pack && (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color={theme.accent} bold>{selected.pack.name}  </Text>
            <Text color={theme.muted}>v{selected.pack.version}  {selected.pack.cases.length} cases</Text>
          </Box>
          {selected.pack.description && (
            <Text color={theme.muted}>{selected.pack.description.slice(0, 120)}</Text>
          )}
          <Table
            rows={selected.pack.cases}
            columns={caseCols}
            height={8}
            focused={false}
            onSelectionChange={(c) => setSelectedCase(c)}
          />
        </Box>
      )}
      {selectedCase && (
        <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor={theme.borderDim} paddingX={1}>
          <Text color={theme.muted}>prompt</Text>
          <Text>{selectedCase.prompt.slice(0, 400)}</Text>
          <Text color={theme.muted}>{'\n'}criteria</Text>
          <Text color={theme.text}>{selectedCase.criteria.slice(0, 400)}</Text>
        </Box>
      )}
    </Box>
  )
}
