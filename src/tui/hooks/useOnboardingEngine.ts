/**
 * React adapter for the onboarding engine. Subscribes to a controller and
 * exposes:
 *   - state:   current OnboardingState (throttled to ~10Hz)
 *   - logs:    last 100 log entries
 *   - send:    dispatch events into the engine
 *   - cancel:  shorthand for controller.cancel()
 *
 * Throttling is critical: the pull state can fire dozens of events per
 * second across multiple parallel downloads. Without it, Ink's reconciler
 * chokes and CPU spikes.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  startOnboarding,
  type OnboardingController,
  type OnboardingEvent,
  type OnboardingLog,
  type OnboardingState,
  type StartOnboardingOptions,
} from '../../onboarding/index.js'

export interface UseOnboardingEngineOptions extends StartOnboardingOptions {
  /** Inject an existing controller (otherwise one is created on mount). */
  controller?: OnboardingController
  /** Min ms between visible state commits. Default 100 (10Hz). */
  throttleMs?: number
  /** Max log entries to retain. Default 100. */
  maxLogs?: number
}

export interface UseOnboardingEngineResult {
  state: OnboardingState
  logs: OnboardingLog[]
  send: (event: OnboardingEvent) => void
  cancel: (reason?: string) => void
  controller: OnboardingController | null
}

export function useOnboardingEngine(
  opts: UseOnboardingEngineOptions = {}
): UseOnboardingEngineResult {
  const throttleMs = opts.throttleMs ?? 100
  const maxLogs = opts.maxLogs ?? 100
  const controllerRef = useRef<OnboardingController | null>(null)
  const [state, setState] = useState<OnboardingState>({ kind: 'welcome' })
  const [logs, setLogs] = useState<OnboardingLog[]>([])

  // Throttled state update.
  const pendingStateRef = useRef<OnboardingState | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingLogsRef = useRef<OnboardingLog[]>([])

  const flush = useCallback(() => {
    timerRef.current = null
    if (pendingStateRef.current) {
      const s = pendingStateRef.current
      pendingStateRef.current = null
      setState(s)
    }
    if (pendingLogsRef.current.length > 0) {
      const buf = pendingLogsRef.current
      pendingLogsRef.current = []
      setLogs(prev => {
        const next = prev.concat(buf)
        return next.length > maxLogs ? next.slice(next.length - maxLogs) : next
      })
    }
  }, [maxLogs])

  const schedule = useCallback(() => {
    if (timerRef.current) return
    timerRef.current = setTimeout(flush, throttleMs)
  }, [flush, throttleMs])

  useEffect(() => {
    const controller =
      opts.controller ??
      startOnboarding({
        configPath: opts.configPath,
        catalogPath: opts.catalogPath,
        ollamaHost: opts.ollamaHost,
        resume: opts.resume,
        force: opts.force,
        detectOnly: opts.detectOnly,
      })
    controllerRef.current = controller

    // Seed initial state synchronously so the first render is correct.
    setState(controller.getState())

    const unsubState = controller.on('state', (s: OnboardingState) => {
      // Coalesce: only the most recent state matters.
      pendingStateRef.current = s
      // Terminal states flush immediately so the UI never appears stuck.
      if (s.kind === 'done' || s.kind === 'cancelled' || s.kind === 'failed') {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        flush()
      } else {
        schedule()
      }
    })

    const unsubLog = controller.on('log', (l: OnboardingLog) => {
      pendingLogsRef.current.push(l)
      schedule()
    })

    return () => {
      unsubState()
      unsubLog()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      // Dispose only if we own the controller.
      if (!opts.controller) controller.dispose()
    }
    // We intentionally only run this once per mount. The dependencies are
    // configuration values that, if they change, would best be handled by
    // remounting the component (a new onboarding session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = useCallback((event: OnboardingEvent) => {
    controllerRef.current?.send(event)
  }, [])

  const cancel = useCallback((reason?: string) => {
    controllerRef.current?.cancel(reason)
  }, [])

  return { state, logs, send, cancel, controller: controllerRef.current }
}
