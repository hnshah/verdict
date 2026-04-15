/**
 * Chart — wraps asciichart.plot() to render multi-series trend lines.
 *
 * Inputs are arrays of numbers padded to the same length; the component
 * normalizes scales and renders at a fixed height.
 */

import { Text, Box } from 'ink'
// asciichart is CJS; use default import under esModuleInterop
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no types shipped
import asciichart from 'asciichart'
import { theme } from '../theme.js'

export interface ChartProps {
  series: number[][]
  height?: number
  title?: string
  min?: number
  max?: number
}

export function Chart({ series, height = 8, title, min, max }: ChartProps) {
  // asciichart needs at least 2 points per series
  const normalized = series
    .filter(s => s.length >= 2)
    .map(s => s.map(v => (Number.isFinite(v) ? v : 0)))

  if (normalized.length === 0) {
    return (
      <Box flexDirection="column">
        {title && <Text color={theme.muted} bold>{title}</Text>}
        <Text color={theme.muted}>  (not enough data for chart)</Text>
      </Box>
    )
  }

  let chart: string
  try {
    chart = asciichart.plot(normalized, {
      height,
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
    }) as string
  } catch {
    chart = '(chart error)'
  }

  return (
    <Box flexDirection="column">
      {title && <Text color={theme.muted} bold>{title}</Text>}
      <Text>{chart}</Text>
    </Box>
  )
}
