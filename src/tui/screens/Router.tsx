/**
 * Router screen — interactive prompt routing.
 *
 * Enter a prompt, pick a task type hint, optionally force local models, and
 * see which model the selector recommends — plus actually call it and show
 * the response.
 *
 * Reuses src/router/selector.ts selectModel + src/providers/compat.ts callModel.
 */

import { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { Spinner } from '@inkjs/ui'
import { theme, scoreColor } from '../theme.js'
import { useDb } from '../hooks/useDb.js'
import { useConfig } from '../hooks/useConfig.js'
import { selectModel, type SelectedModel } from '../../router/selector.js'
import { callModel } from '../../providers/compat.js'
import { buildModelConfig } from '../../utils/model-config.js'

export interface RouterProps {
  onBack?: () => void
}

const TASK_TYPES = ['any', 'reasoning', 'coding', 'writing', 'instruction', 'fast', 'general'] as const
type TaskType = typeof TASK_TYPES[number]

type Phase = 'compose' | 'routing' | 'calling' | 'done' | 'error'

export function Router(_props: RouterProps) {
  const db = useDb()
  const { config } = useConfig('./verdict.yaml')
  const [prompt, setPrompt] = useState('')
  const [taskIdx, setTaskIdx] = useState(0)
  const [preferLocal, setPreferLocal] = useState(false)
  const [phase, setPhase] = useState<Phase>('compose')
  const [selected, setSelected] = useState<SelectedModel | null>(null)
  const [response, setResponse] = useState<string>('')
  const [latency, setLatency] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  const taskType = TASK_TYPES[taskIdx]

  const run = async () => {
    if (!prompt.trim()) return
    setPhase('routing')
    setError(null)
    try {
      const picked = selectModel(db, {
        taskType: taskType === 'any' ? undefined : taskType,
        preferLocal,
      })
      if (!picked) {
        setError('No model has history yet — run some evals first')
        setPhase('error')
        return
      }
      setSelected(picked)
      // Find the model config; build one if not in verdict.yaml
      const modelCfg = config?.models.find(m => m.id === picked.modelId)
        ?? buildModelConfig(picked.modelId, picked.provider)
      setPhase('calling')
      const t0 = Date.now()
      const resp = await callModel(modelCfg, prompt, 0)
      setLatency(Date.now() - t0)
      setResponse(resp.error ? `[error] ${resp.error}` : resp.text)
      setPhase('done')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  useInput((input, key) => {
    if (phase === 'routing' || phase === 'calling') return

    if (key.tab) {
      setTaskIdx(i => (i + 1) % TASK_TYPES.length)
      return
    }
    if (input === 'L') { setPreferLocal(p => !p); return }

    if (phase === 'done' || phase === 'error') {
      if (input === 'r') { setPrompt(''); setResponse(''); setSelected(null); setPhase('compose') }
      return
    }

    if (key.return) { run(); return }
    if (key.backspace || key.delete) { setPrompt(p => p.slice(0, -1)); return }
    if (input && !key.ctrl && !key.meta) setPrompt(p => p + input)
  })

  // Auto-reset when phase changes
  useEffect(() => {
    // noop — hook placeholder
  }, [phase])

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>🧭 Router  </Text>
        <Text color={theme.muted}>
          Tab: task type · L: prefer local · Enter: route & call
        </Text>
      </Box>

      <Box>
        <Text color={theme.muted}>task:  </Text>
        {TASK_TYPES.map((t, i) => (
          <Text
            key={t}
            color={i === taskIdx ? theme.highlight : theme.muted}
            bold={i === taskIdx}
          >{t}  </Text>
        ))}
      </Box>
      <Box>
        <Text color={theme.muted}>local: </Text>
        <Text color={preferLocal ? theme.success : theme.muted}>
          [{preferLocal ? 'x' : ' '}] prefer local
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.accent}>▸ </Text>
        <Text>{prompt}</Text>
        {phase === 'compose' && <Text color={theme.muted}>▏</Text>}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.danger}>✗ {error}</Text>
        </Box>
      )}

      {selected && (
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1}>
          <Box>
            <Text color={theme.accent} bold>selected  </Text>
            <Text color={theme.text}>{selected.modelId}</Text>
            <Text color={theme.muted}>  · {selected.provider}</Text>
            <Text color={theme.muted}>  · score </Text>
            <Text color={scoreColor(selected.score)}>{selected.score.toFixed(2)}</Text>
          </Box>
          <Text color={theme.muted}>{selected.reason}</Text>
        </Box>
      )}

      {phase === 'routing' && (
        <Box marginTop={1}>
          <Spinner /><Text color={theme.primary}> routing…</Text>
        </Box>
      )}

      {phase === 'calling' && (
        <Box marginTop={1}>
          <Spinner /><Text color={theme.primary}> calling {selected?.modelId}…</Text>
        </Box>
      )}

      {phase === 'done' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.muted}>response  <Text color={theme.muted}>({latency}ms)</Text></Text>
          <Text color={theme.text}>{response.slice(0, 1200)}</Text>
          <Box marginTop={1}>
            <Text color={theme.success}>✓ Done.  </Text>
            <Text color={theme.muted}>r: another prompt</Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
