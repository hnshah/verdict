/**
 * RunDetail — per-case breakdown for a single run.
 *
 * Reads question_results rows directly via the raw DB (existing saveRunResult
 * persists them). In Phase 2 we'll wire richer per-case JSON display.
 */

import { useEffect, useMemo, useState } from 'react'
import { Box, Text } from 'ink'
import { theme, scoreColor } from '../theme.js'
import { Table, type Column } from '../components/Table.js'
import { useDb } from '../hooks/useDb.js'
import type { EvalHistoryRow } from '../../db/client.js'

export interface RunDetailProps {
  row: EvalHistoryRow
  onBack: () => void
}

interface CaseRow {
  case_id: string
  prompt: string
  score: number
  latency_ms: number | null
  response: string | null
}

export function RunDetail({ row, onBack: _onBack }: RunDetailProps) {
  const db = useDb()
  const [cases, setCases] = useState<CaseRow[]>([])
  const [selected, setSelected] = useState<CaseRow | null>(null)

  useEffect(() => {
    try {
      const stmt = db.prepare(`
        SELECT qr.case_id, qr.prompt, qr.score, qr.latency_ms, qr.response
          FROM question_results qr
          JOIN eval_results er ON er.id = qr.eval_result_id
         WHERE er.run_id = @run_id AND qr.model_id = @model_id
         ORDER BY qr.id ASC
      `)
      const rows = stmt.all({ run_id: row.run_id, model_id: row.model_id }) as CaseRow[]
      setCases(rows)
    } catch {
      setCases([])
    }
  }, [db, row.run_id, row.model_id])

  const columns: Column<CaseRow>[] = useMemo(() => [
    { key: 'id',    header: 'CASE',   width: 22, render: c => c.case_id },
    { key: 'score', header: 'SCORE',  width: 6, align: 'right',
      render: c => c.score.toFixed(2),
      color: c => scoreColor(c.score) },
    { key: 'lat',   header: 'LAT ms', width: 7, align: 'right',
      render: c => (c.latency_ms ?? 0).toFixed(0) },
    { key: 'prompt', header: 'PROMPT', width: 40,
      render: c => c.prompt.slice(0, 38).replace(/\n/g, ' ') },
  ], [])

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text color={theme.accent} bold>📊 {row.model_id}  </Text>
        <Text color={theme.muted}>
          {row.pack} · {row.cases_run} cases · avg{' '}
          <Text color={scoreColor(row.score)}>{row.score.toFixed(2)}</Text>
          {row.total_cost_usd != null && <> · ${row.total_cost_usd.toFixed(4)}</>}
        </Text>
        <Text color={theme.muted}>run_id: {row.run_id}</Text>
      </Box>
      <Table
        rows={cases}
        columns={columns}
        height={12}
        emptyMessage="No per-case data stored for this run"
        onSelectionChange={(r) => setSelected(r)}
      />
      {selected && (
        <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor={theme.borderDim} paddingX={1}>
          <Text color={theme.muted}>prompt</Text>
          <Text>{selected.prompt.slice(0, 500)}</Text>
          <Text color={theme.muted}>{'\n'}response</Text>
          <Text color={theme.text}>{(selected.response ?? '').slice(0, 800)}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.muted}>Esc: back to runs</Text>
      </Box>
    </Box>
  )
}
