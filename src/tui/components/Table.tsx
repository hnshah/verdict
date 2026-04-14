/**
 * Simple scrollable table. Viewport-windowed so ~10k rows scroll smoothly.
 *
 * No virtualized re-render magic — we just slice the rows array to the
 * visible window. That's plenty for <10k rows and avoids DOM-like diffing.
 */

import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme, type ThemeColor } from '../theme.js'

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

  useInput((input, key) => {
    if (!focused || rows.length === 0) return
    let next = cursor
    if (input === 'j' || key.downArrow) next = Math.min(cursor + 1, rows.length - 1)
    else if (input === 'k' || key.upArrow) next = Math.max(cursor - 1, 0)
    else if (key.pageDown) next = Math.min(cursor + height, rows.length - 1)
    else if (key.pageUp) next = Math.max(cursor - height, 0)
    else if (input === 'g') next = 0
    else if (input === 'G') next = rows.length - 1
    else if (key.return && onEnter) { onEnter(rows[cursor], cursor); return }
    else return
    if (next !== cursor) {
      setCursor(next)
      if (next < offset) setOffset(next)
      else if (next >= offset + height) setOffset(next - height + 1)
      if (onSelectionChange) onSelectionChange(rows[next] ?? null, next)
    }
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
        return (
          <Box key={absoluteIdx}>
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
