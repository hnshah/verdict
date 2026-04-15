/**
 * Simple scrollable table. Viewport-windowed so ~10k rows scroll smoothly.
 *
 * Mouse support:
 *   - Click a row to select it
 *   - Double-click (or click a row that's already selected) to activate (Enter)
 *   - Scroll wheel jumps the selection up/down
 *
 * No virtualized re-render magic — we just slice the rows array to the
 * visible window. That's plenty for <10k rows and avoids DOM-like diffing.
 */

import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme, type ThemeColor } from '../theme.js'
import { Clickable } from './Clickable.js'

export interface Column<T> {
  key: string
  header: string
  width?: number
  align?: 'left' | 'right'
  render: (row: T) => string
  color?: (row: T) => ThemeColor | undefined
}

export interface TableProps<T> {
  rows: T[]
  columns: Column<T>[]
  focused?: boolean
  height?: number
  emptyMessage?: string
  onEnter?: (row: T, index: number) => void
  onSelectionChange?: (row: T | null, index: number) => void
}

function padCell(s: string, width: number, align: 'left' | 'right' = 'left'): string {
  if (s.length >= width) return s.slice(0, width)
  const pad = ' '.repeat(width - s.length)
  return align === 'right' ? pad + s : s + pad
}

export function Table<T>({
  rows,
  columns,
  focused = true,
  height = 15,
  emptyMessage = 'No rows',
  onEnter,
  onSelectionChange,
}: TableProps<T>) {
  const [cursor, setCursor] = useState(0)
  const [offset, setOffset] = useState(0)

  const moveTo = (next: number) => {
    const clamped = Math.max(0, Math.min(next, rows.length - 1))
    if (clamped === cursor) return
    setCursor(clamped)
    if (clamped < offset) setOffset(clamped)
    else if (clamped >= offset + height) setOffset(clamped - height + 1)
    if (onSelectionChange) onSelectionChange(rows[clamped] ?? null, clamped)
  }

  useInput((input, key) => {
    if (!focused || rows.length === 0) return
    if (input === 'j' || key.downArrow) moveTo(cursor + 1)
    else if (input === 'k' || key.upArrow) moveTo(cursor - 1)
    else if (key.pageDown) moveTo(cursor + height)
    else if (key.pageUp) moveTo(cursor - height)
    else if (input === 'g') moveTo(0)
    else if (input === 'G') moveTo(rows.length - 1)
    else if (key.return && onEnter) onEnter(rows[cursor], cursor)
  }, { isActive: focused })

  const visibleRows = rows.slice(offset, offset + height)

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        {columns.map(c => (
          <Text key={c.key} color={theme.muted} bold>
            {padCell(c.header, c.width ?? 12, c.align)}{' '}
          </Text>
        ))}
      </Box>
      {/* Rows */}
      {rows.length === 0 && (
        <Text color={theme.muted}>  {emptyMessage}</Text>
      )}
      {visibleRows.map((row, i) => {
        const absoluteIdx = offset + i
        const isSelected = absoluteIdx === cursor
        const rowNode = (
          <Box>
            {columns.map(c => {
              const raw = c.render(row)
              const color = c.color?.(row)
              return (
                <Text
                  key={c.key}
                  color={isSelected ? theme.highlight : color}
                  inverse={isSelected && focused}
                >
                  {padCell(raw, c.width ?? 12, c.align)}{' '}
                </Text>
              )
            })}
          </Box>
        )
        return (
          <Clickable
            key={absoluteIdx}
            onClick={() => {
              // Click already-selected row → activate (Enter). Click elsewhere → select.
              if (absoluteIdx === cursor && onEnter) onEnter(row, absoluteIdx)
              else moveTo(absoluteIdx)
            }}
            onWheelUp={() => moveTo(cursor - 1)}
            onWheelDown={() => moveTo(cursor + 1)}
          >
            {rowNode}
          </Clickable>
        )
      })}
      {/* Scroll indicator */}
      {rows.length > height && (
        <Text color={theme.muted} dimColor>
          {' '}
          {Math.min(offset + height, rows.length)}/{rows.length}
        </Text>
      )}
    </Box>
  )
}
