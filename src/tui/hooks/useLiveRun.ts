/**
 * Wraps core/runner.ts runEvals() with a React-friendly event log.
 *
 * runEvals accepts onProgress(msg: string). The TUI captures every message
 * and exposes:
 *   - log:      all messages (for LogStream pane)
 *   - phase:    'idle' | 'running' | 'done' | 'error'
 *   - current:  the last message (status line)
 *   - result:   the RunResult when done
 *
 * Throttled to ~30fps to avoid flicker on high-frequency updates.
 */

import { useCallback, useRef, useState } from 'react'
import { runEvals } from '../../core/runner.js'
import { loadConfig, loadEvalPack } from '../../core/config.js'
import path from 'path'
import type { Config, EvalPack, RunResult } from '../../types/index.js'

export type Phase = 'idle' | 'running' | 'done' | 'error'

export interface LiveRunState {
  phase: Phase
  current: string
  log: string[]
  result: RunResult | null
  error: string | null
}

export function useLiveRun() {
  const [state, setState] = useState<LiveRunState>({
    phase: 'idle',
    current: '',
    log: [],
    result: null,
    error: null,
  })
  const pendingRef = useRef<string[]>([])
  const rafRef = useRef<NodeJS.Timeout | null>(null)

  const flush = useCallback(() => {
    const pending = pendingRef.current
    if (pending.length === 0) return
    pendingRef.current = []
    setState(s => ({
      ...s,
      log: [...s.log, ...pending].slice(-500),
      current: pending[pending.length - 1] ?? s.current,
    }))
  }, [])

  const push = useCallback((msg: string) => {
    pendingRef.current.push(msg)
    if (rafRef.current) return
    rafRef.current = setTimeout(() => {
      rafRef.current = null
      flush()
    }, 33) // ~30 fps
  }, [flush])

  const start = useCallback(async (opts: {
    configPath?: string
    config?: Config
    packs?: EvalPack[]
    resume?: boolean
    categoryFilter?: string[]
  }) => {
    setState({ phase: 'running', current: '', log: [], result: null, error: null })
    try {
      const cfgPath = opts.configPath ?? './verdict.yaml'
      const config = opts.config ?? loadConfig(path.resolve(cfgPath))
      const packs = opts.packs ?? config.packs.map(p =>
        loadEvalPack(p, path.dirname(path.resolve(cfgPath)))
      )
      const result = await runEvals(
        config, packs, push, opts.resume, opts.categoryFilter, true, cfgPath
      )
      // Ensure any pending messages flushed before we mark done
      flush()
      setState(s => ({ ...s, phase: 'done', result }))
    } catch (e) {
      flush()
      setState(s => ({ ...s, phase: 'error', error: (e as Error).message }))
    }
  }, [push, flush])

  return { state, start }
}
