/**
 * Synced-scroll side-by-side diff of two model-summary sets.
 *
 * Takes the `deltas` from `compareWithBaseline` plus newModels/removedModels
 * and renders a two-column view with regression highlights.
 *
 * Phase 2 keeps this flat (no scroll) because summaries are O(models) which
 * is rarely >20. Per-case diffing is Phase 3.
 */

import { Box, Text } from 'ink'
import { theme, scoreColor } from '../theme.js'
import type { BaselineComparison } from '../../types/index.js'

export interface DiffPaneProps {
  comparison: BaselineComparison
  nameA?: string
  nameB?: string
}

function formatDelta(delta: number): { text: string; color: string } {
  if (Math.abs(delta) < 0.05) return { text: ' —   ', color: theme.muted }
  const sign = delta > 0 ? '+' : ''
  const text = `${sign}${delta.toFixed(2)}`
  return { text: text.padStart(6), color: delta > 0 ? theme.success : theme.danger }
}

export function DiffPane({ comparison, nameA = 'baseline', nameB = 'current' }: DiffPaneProps) {
  const sorted = [...comparison.deltas].sort((a, b) => b.scoreB - a.scoreB)

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        <Text color={theme.muted} bold>{'MODEL'.padEnd(30)} </Text>
        <Text color={theme.muted} bold>{nameA.padStart(7)}  </Text>
        <Text color={theme.muted} bold>{nameB.padStart(7)}  </Text>
        <Text color={theme.muted} bold>{'Δ'.padStart(6)}   </Text>
        <Text color={theme.muted} bold>{'%'.padStart(6)}   </Text>
      </Box>

      {sorted.length === 0 && (
        <Text color={theme.muted}>  No shared models between runs</Text>
      )}

      {sorted.map(d => {
        const dlt = formatDelta(d.delta)
        return (
          <Box key={d.model}>
            <Text color={d.regression ? theme.regression : theme.text}>
              {d.regression ? '⚠ ' : '  '}{d.model.padEnd(28).slice(0, 28)} </Text>
            <Text color={scoreColor(d.scoreA)}>{d.scoreA.toFixed(2).padStart(7)}  </Text>
            <Text color={scoreColor(d.scoreB)}>{d.scoreB.toFixed(2).padStart(7)}  </Text>
            <Text color={dlt.color}>{dlt.text}  </Text>
            <Text color={dlt.color}>
              {(d.pctChange > 0 ? '+' : '') + d.pctChange.toFixed(1) + '%'}
            </Text>
          </Box>
        )
      })}

      {/* New / removed models */}
      {comparison.newModels.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.success} bold>+ New models</Text>
          {comparison.newModels.map(m => (
            <Text key={m} color={theme.success}>  + {m}</Text>
          ))}
        </Box>
      )}
      {comparison.removedModels.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.danger} bold>− Removed models</Text>
          {comparison.removedModels.map(m => (
            <Text key={m} color={theme.danger}>  - {m}</Text>
          ))}
        </Box>
      )}

      {/* Regression banner */}
      {comparison.regressionAlert && (
        <Box marginTop={1} borderStyle="single" borderColor={theme.danger} paddingX={1}>
          <Text color={theme.danger} bold>⚠ Regression detected — one or more models dropped {'>'}0.5 points</Text>
        </Box>
      )}
    </Box>
  )
}
