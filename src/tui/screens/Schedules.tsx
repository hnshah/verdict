/**
 * Schedules screen — list cron-driven eval schedules.
 *
 * Key bindings:
 *   j/k ↑/↓        Move selection
 *   Enter          Show details pane
 *   r              Run selected schedule now (enqueues a job)
 *   Space          Toggle pause/resume
 *   d              Delete (behind ConfirmDialog)
 *   ?              Global help
 *
 * All mutations go through the shared db/client.ts helpers, so CLI and TUI
 * stay in sync.
 */

import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from '../theme.js'
import { useDb } from '../hooks/useDb.js'
import { useSchedules } from '../hooks/useSchedules.js'
import { useToast } from '../hooks/useToast.js'
import { Table, type Column } from '../components/Table.js'
import { ConfirmDialog } from '../components/ConfirmDialog.js'
import { nextCronTime, describeNext } from '../../scheduler/cron.js'
import {
  addJob,
  updateSchedule,
  removeSchedule,
  type ScheduleRow,
} from '../../db/client.js'

export interface SchedulesProps {
  onBack?: () => void
}

export function Schedules(_props: SchedulesProps) {
  const db = useDb()
  const { rows, refresh } = useSchedules(3000)
  const [selected, setSelected] = useState<ScheduleRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const toast = useToast()

  useInput((input, _key) => {
    if (confirmDelete) return
    if (!selected && rows.length > 0) setSelected(rows[0])
    const target = selected ?? rows[0]
    if (!target) return

    if (input === 'r') {
      const jobId = enqueueNow(target)
      toast(`Enqueued job ${jobId} for "${target.name}"`)
      refresh()
    } else if (input === ' ') {
      togglePaused(target)
      toast(`${target.enabled ? 'Paused' : 'Resumed'} "${target.name}"`)
      refresh()
    } else if (input === 'd') {
      setConfirmDelete(true)
    }
  })

  const enqueueNow = (s: ScheduleRow): number => {
    const input: Record<string, unknown> = {}
    if (s.config_path) input['configPath'] = s.config_path
    if (s.packs) input['packs'] = s.packs.split(',').map(x => x.trim()).filter(Boolean)
    if (s.models) input['models'] = s.models.split(',').map(x => x.trim()).filter(Boolean)
    if (s.category) input['category'] = s.category.split(',').map(x => x.trim()).filter(Boolean)
    return addJob(db, {
      type: 'eval',
      input: JSON.stringify(input),
      priority: 10,
      metadata: JSON.stringify({ scheduleId: s.id, scheduleName: s.name, manual: true }),
    })
  }

  const togglePaused = (s: ScheduleRow) => {
    const next = s.enabled ? null : nextCronTime(s.cron)
    updateSchedule(db, s.id, {
      enabled: s.enabled ? 0 : 1,
      next_run_at: next ? next.toISOString() : null,
    })
  }

  const doDelete = () => {
    if (!selected) return
    const name = selected.name
    removeSchedule(db, name)
    setConfirmDelete(false)
    setSelected(null)
    toast(`Deleted "${name}"`)
    refresh()
  }

  const cols: Column<ScheduleRow>[] = [
    { key: 'name',    header: 'NAME',     width: 22, render: s => s.name },
    { key: 'cron',    header: 'CRON',     width: 14, render: s => s.cron },
    {
      key: 'next', header: 'NEXT', width: 20,
      render: s => {
        if (!s.enabled) return '(paused)'
        if (!s.next_run_at) return '-'
        const d = new Date(s.next_run_at)
        return describeNext(d)
      },
      color: s => s.enabled ? undefined : theme.muted,
    },
    {
      key: 'last', header: 'LAST RUN', width: 20,
      render: s => s.last_run_at?.slice(0, 19).replace('T', ' ') ?? '-',
    },
    {
      key: 'status', header: 'STATUS', width: 12,
      render: s => s.last_status ?? '-',
      color: s => {
        if (s.last_status === 'regression') return theme.danger
        if (s.last_status === 'error') return theme.danger
        if (s.last_status === 'ok') return theme.success
        return theme.muted
      },
    },
    { key: 'source',  header: 'SOURCE',   width: 8, render: s => s.source },
  ]

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>⏰ Schedules  </Text>
        <Text color={theme.muted}>
          j/k: move · Enter: details · r: run now · Space: pause/resume · d: delete
        </Text>
      </Box>

      {rows.length === 0 ? (
        <Box flexDirection="column">
          <Text color={theme.muted}>No schedules yet.</Text>
          <Text color={theme.muted}>Create one with:</Text>
          <Text color={theme.highlight}>{'  verdict schedule add nightly --cron "0 2 * * *" --pack general'}</Text>
          <Text color={theme.muted}>…or add a <Text color={theme.highlight}>schedules:</Text> block to <Text color={theme.highlight}>verdict.yaml</Text>.</Text>
        </Box>
      ) : (
        <Table
          rows={rows}
          columns={cols}
          height={12}
          focused={!confirmDelete}
          emptyMessage="No schedules"
          onSelectionChange={(row) => setSelected(row)}
          onEnter={(row) => setSelected(row)}
        />
      )}

      {selected && (
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1}>
          <Box>
            <Text color={theme.accent} bold>{selected.name}  </Text>
            <Text color={theme.muted}>cron </Text>
            <Text color={theme.text}>{selected.cron}</Text>
            {selected.enabled ? null : <Text color={theme.warning}>  (paused)</Text>}
          </Box>
          {selected.packs && <Text color={theme.muted}>packs: <Text color={theme.text}>{selected.packs}</Text></Text>}
          {selected.models && <Text color={theme.muted}>models: <Text color={theme.text}>{selected.models}</Text></Text>}
          {selected.category && <Text color={theme.muted}>category: <Text color={theme.text}>{selected.category}</Text></Text>}
          {selected.on_regression && (
            <Text color={theme.muted}>on_regression: <Text color={theme.text}>{selected.on_regression}</Text></Text>
          )}
          <Text color={theme.muted}>next_run: <Text color={theme.text}>{selected.next_run_at ?? '-'}</Text></Text>
          <Text color={theme.muted}>last_run: <Text color={theme.text}>{selected.last_run_at ?? '-'}</Text></Text>
        </Box>
      )}

      {confirmDelete && selected && (
        <Box marginTop={1}>
          <ConfirmDialog
            message={`Delete schedule "${selected.name}"? This can't be undone.`}
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={doDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        </Box>
      )}
    </Box>
  )
}
