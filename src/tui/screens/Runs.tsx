/**
 * Runs screen — paginated history table filterable by `/`.
 * Enter opens RunDetail for the selected row.
 */

import { useMemo, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme, scoreColor } from '../theme.js'
import { Table, type Column } from '../components/Table.js'
import { FilterInput } from '../components/FilterInput.js'
import { useHistory } from '../hooks/useDb.js'
import { useToast } from '../hooks/useToast.js'
import { writeClipboard } from '../utils/clipboard.js'
import type { EvalHistoryRow } from '../../db/client.js'
import type { Mode } from '../hooks/useKeymap.js'

export interface RunsProps {
  mode: Mode
  filterQuery: string
  onFilterChange: (q: string) => void
  onOpenRun: (row: EvalHistoryRow) => void
  onStartLiveRun: () => void
  onExitFilter: () => void
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toISOString().slice(0, 16).replace('T', ' ')
  } catch { return iso.slice(0, 16) }
}

export function Runs({ mode, filterQuery, onFilterChange, onOpenRun, onStartLiveRun, onExitFilter }: RunsProps) {
  const { rows } = useHistory({ limit: 500 }, 5000)
  const [selected, setSelected] = useState<EvalHistoryRow | null>(null)
  const toast = useToast()

  const filtered = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.model_id.toLowerCase().includes(q) ||
      r.pack.toLowerCase().includes(q) ||
      (r.provider ?? '').toLowerCase().includes(q) ||
      r.run_id.toLowerCase().includes(q)
    )
  }, [rows, filterQuery])

  const listFocused = mode === 'normal'

  useInput((input) => {
    if (mode !== 'normal') return
    if (input === 'n') { onStartLiveRun(); return }
    if (input === 'y' && selected) {
      const text = `${selected.run_id} ${selected.model_id}`
      void writeClipboard(text).then(res => {
        toast(res.ok ? `yanked: ${selected.run_id}` : 'clipboard tool not found')
      })
    }
  }, { isActive: mode === 'normal' })

  const columns: Column<EvalHistoryRow>[] = [
    { key: 'when',  header: 'WHEN',   width: 17, render: r => fmtDate(r.run_at) },
    { key: 'model', header: 'MODEL',  width: 30, render: r => r.model_id },
    { key: 'pack',  header: 'PACK',   width: 18, render: r => r.pack },
    { key: 'score', header: 'SCORE',  width: 6, align: 'right',
      render: r => r.score.toFixed(2),
      color: r => scoreColor(r.score) },
    { key: 'cases', header: 'CASES',  width: 6, align: 'right', render: r => String(r.cases_run) },
    { key: 'wins',  header: 'WINS',   width: 5, align: 'right', render: r => String(r.wins) },
    { key: 'lat',   header: 'LAT ms', width: 7, align: 'right',
      render: r => (r.avg_latency_ms ?? 0).toFixed(0) },
  ]

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>📜 Run history  </Text>
        <Text color={theme.muted}>({filtered.length}/{rows.length} shown)  </Text>
        <Text color={theme.muted}>n: new run · Enter: open</Text>
      </Box>
      <Table
        rows={filtered}
        columns={columns}
        focused={listFocused}
        height={18}
        emptyMessage={filterQuery ? 'No matching runs' : 'No runs yet — press n to start one'}
        onEnter={(row) => onOpenRun(row)}
        onSelectionChange={(row) => setSelected(row)}
      />
      {mode === 'filter' && (
        <Box marginTop={1}>
          <FilterInput
            value={filterQuery}
            onChange={onFilterChange}
            onSubmit={onExitFilter}
            onCancel={() => { onFilterChange(''); onExitFilter() }}
            active
          />
        </Box>
      )}
      {selected && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.muted}>─ selected ────────────────────────</Text>
          <Text color={theme.text}>
            <Text color={theme.muted}>run_id: </Text>{selected.run_id}
          </Text>
          {selected.total_cost_usd != null && (
            <Text color={theme.text}>
              <Text color={theme.muted}>cost:   </Text>${selected.total_cost_usd.toFixed(4)}
            </Text>
          )}
          {selected.tokens_per_sec != null && (
            <Text color={theme.text}>
              <Text color={theme.muted}>tok/s:  </Text>{selected.tokens_per_sec.toFixed(1)}
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
}
