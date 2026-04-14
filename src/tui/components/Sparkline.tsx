/**
 * Thin wrapper around `sparkly` for per-model score trend display.
 */

import { Text } from 'ink'
import sparkly from 'sparkly'
import { theme, type ThemeColor } from '../theme.js'

export interface SparklineProps {
  values: number[]
  color?: ThemeColor
}

export function Sparkline({ values, color = theme.highlight }: SparklineProps) {
  if (values.length === 0) return <Text color={theme.muted}>·</Text>
  const chart = sparkly(values)
  return <Text color={color}>{chart}</Text>
}
