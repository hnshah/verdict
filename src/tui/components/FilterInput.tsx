/**
 * Small '/' filter bar. Displays when focused; screens pass the query into
 * their own filter predicate.
 */

import { Box, Text, useInput } from 'ink'
import { theme } from '../theme.js'

export interface FilterInputProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  active: boolean
}

export function FilterInput({ value, onChange, onSubmit, onCancel, active }: FilterInputProps) {
  useInput((input, key) => {
    if (!active) return
    if (key.escape) { onCancel(); return }
    if (key.return) { onSubmit(); return }
    if (key.backspace || key.delete) { onChange(value.slice(0, -1)); return }
    if (input && !key.ctrl && !key.meta) onChange(value + input)
  }, { isActive: active })

  if (!active && !value) return null

  return (
    <Box>
      <Text color={theme.accent}>/</Text>
      <Text>{value}</Text>
      {active && <Text color={theme.muted}>▏</Text>}
    </Box>
  )
}
