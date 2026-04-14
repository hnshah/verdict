/**
 * Models screen — list configured models from verdict.yaml and (on 'd')
 * discover local Ollama/MLX running servers.
 */

import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from '../theme.js'
import { Table, type Column } from '../components/Table.js'
import { useConfig } from '../hooks/useConfig.js'
import { discoverOllama } from '../../providers/ollama.js'
import { discoverMLX } from '../../providers/mlx.js'
import type { DiscoveredModel, ModelConfig } from '../../types/index.js'

export interface ModelsProps {
  onBack?: () => void
}

export function Models(_props: ModelsProps) {
  const { config, error } = useConfig('./verdict.yaml')
  const [discovered, setDiscovered] = useState<DiscoveredModel[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  const discover = async () => {
    setScanning(true)
    setScanError(null)
    try {
      const [oll, mlx] = await Promise.all([
        discoverOllama().catch(() => []),
        discoverMLX().catch(() => []),
      ])
      setDiscovered([...oll, ...mlx])
    } catch (e) {
      setScanError((e as Error).message)
    } finally {
      setScanning(false)
    }
  }

  useInput((input) => {
    if (input === 'd') discover()
  })

  const configuredCols: Column<ModelConfig>[] = [
    { key: 'id', header: 'ID', width: 26, render: m => m.id },
    { key: 'provider', header: 'PROVIDER', width: 10, render: m => m.provider ?? 'compat' },
    { key: 'model', header: 'MODEL', width: 30, render: m => m.model },
    { key: 'tags', header: 'TAGS', width: 20, render: m => (m.tags ?? []).join(', ') },
  ]

  const discoveredCols: Column<DiscoveredModel>[] = [
    { key: 'provider', header: 'PROVIDER', width: 10, render: m => m.provider },
    { key: 'model', header: 'MODEL', width: 34, render: m => m.model },
    { key: 'size', header: 'SIZE', width: 7, align: 'right',
      render: m => m.size_gb ? m.size_gb.toFixed(1) + 'G' : '-' },
    { key: 'moe', header: 'MoE', width: 4, render: m => m.is_moe ? '●' : ' ' },
    { key: 'tags', header: 'TAGS', width: 18, render: m => m.tags.join(', ') },
  ]

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>🤖 Configured models  </Text>
        <Text color={theme.muted}>(from verdict.yaml)  </Text>
        <Text color={theme.muted}>d: discover local</Text>
      </Box>

      {error && <Text color={theme.danger}>  {error}</Text>}

      {config && (
        <Table
          rows={config.models}
          columns={configuredCols}
          height={10}
          emptyMessage="No models configured"
        />
      )}

      <Box marginTop={2}>
        <Text color={theme.accent} bold>🔎 Discovered on this machine  </Text>
        {scanning && <Text color={theme.primary}>scanning…</Text>}
        {!scanning && discovered.length > 0 && (
          <Text color={theme.muted}>({discovered.length} found)</Text>
        )}
      </Box>
      {scanError && <Text color={theme.danger}>  {scanError}</Text>}
      {!scanning && discovered.length === 0 && (
        <Text color={theme.muted}>  Press <Text color={theme.highlight}>d</Text> to scan Ollama / MLX / LM Studio</Text>
      )}
      {discovered.length > 0 && (
        <Table
          rows={discovered}
          columns={discoveredCols}
          height={8}
          focused={false}
        />
      )}
    </Box>
  )
}
