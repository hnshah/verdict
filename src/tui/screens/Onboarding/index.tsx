/**
 * Onboarding screen — dispatches to a sub-view per engine state. The engine
 * itself is owned by useOnboardingEngine(); this component is purely a
 * router + a tiny global-keybind shim (Ctrl-C / q → cancel).
 *
 * In TUI launches we don't auto-advance through welcome/plan/consent — the
 * sub-views render explicit prompts so the user is in control. The CLI's
 * headless mode is what auto-drives (see src/onboarding/cli.ts).
 */

import { useEffect } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { theme } from '../../theme.js'
import { useOnboardingEngine } from '../../hooks/useOnboardingEngine.js'
import type {
  OnboardingController,
  StartOnboardingOptions,
} from '../../../onboarding/index.js'
import { StateHeader } from './StateHeader.js'
import { Welcome } from './Welcome.js'
import { Detect } from './Detect.js'
import { Plan } from './Plan.js'
import { Consent } from './Consent.js'
import { Install } from './Install.js'
import { Pull } from './Pull.js'
import { Configure } from './Configure.js'
import { Verify } from './Verify.js'
import { Done } from './Done.js'
import { Cancelled } from './Cancelled.js'
import { Failed } from './Failed.js'

export interface OnboardingProps extends StartOnboardingOptions {
  /** Inject an external controller (used by the standalone launcher). */
  controller?: OnboardingController
  /** Called when user completes or skips; fires on terminal state + Enter. */
  onExit?: () => void
}

export function Onboarding(props: OnboardingProps) {
  const { state, logs, send, cancel } = useOnboardingEngine({
    controller: props.controller,
    configPath: props.configPath,
    catalogPath: props.catalogPath,
    ollamaHost: props.ollamaHost,
    resume: props.resume,
    force: props.force,
    detectOnly: props.detectOnly,
  })
  const { exit } = useApp()

  // Global Ctrl-C → cancel (don't kill the process directly so the engine
  // gets a chance to clean up children + persist the cancelled mark).
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (state.kind === 'done' || state.kind === 'cancelled' || state.kind === 'failed') {
        exit()
        setTimeout(() => process.exit(0), 50)
      } else {
        cancel('SIGINT')
      }
    }
  })

  // When we reach a terminal state, allow `q` to exit cleanly.
  useEffect(() => {
    if (state.kind === 'done' && !props.onExit) {
      // Default behavior: stay on Done until user presses Enter (which the
      // Done component handles via its own useInput).
    }
  }, [state.kind, props.onExit])

  const handleExit = () => {
    props.onExit?.()
    exit()
    setTimeout(() => process.exit(0), 50)
  }

  return (
    <Box flexDirection="column" padding={1}>
      <StateHeader state={state} />
      {renderBody(state, { send, cancel, onExit: handleExit })}
      {logs.length > 0 && (state.kind === 'install' || state.kind === 'pull') && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor={theme.borderDim} paddingX={1}>
          <Text color={theme.dim} bold>recent activity</Text>
          {logs.slice(-6).map((l, i) => (
            <Text key={i} color={l.level === 'error' ? theme.danger : l.level === 'warn' ? theme.warning : theme.muted}>
              {l.source ? `[${l.source}] ` : ''}{l.msg}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

interface BodyHandlers {
  send: ReturnType<typeof useOnboardingEngine>['send']
  cancel: ReturnType<typeof useOnboardingEngine>['cancel']
  onExit: () => void
}

function renderBody(
  state: ReturnType<typeof useOnboardingEngine>['state'],
  h: BodyHandlers
) {
  switch (state.kind) {
    case 'welcome':
      return (
        <Welcome
          onNext={() => h.send({ type: 'next' })}
          onCancel={() => h.send({ type: 'skip-onboarding' })}
        />
      )
    case 'detect':
      return <Detect state={state} />
    case 'plan':
      return (
        <Plan
          state={state}
          onNext={() => h.send({ type: 'next' })}
          onBack={() => h.send({ type: 'back' })}
        />
      )
    case 'consent':
      return (
        <Consent
          state={state}
          onConfirm={() => h.send({ type: 'consent-given' })}
          onBack={() => h.send({ type: 'back' })}
        />
      )
    case 'install':
      return <Install state={state} />
    case 'pull':
      return <Pull state={state} />
    case 'configure':
      return <Configure state={state} />
    case 'verify':
      return <Verify state={state} />
    case 'done':
      return <Done state={state} onExit={h.onExit} />
    case 'cancelled':
      return (
        <Cancelled
          state={state}
          onRetry={() => h.send({ type: 'retry' })}
          onExit={h.onExit}
        />
      )
    case 'failed':
      return (
        <Failed
          state={state}
          onRetry={() => h.send({ type: 'retry' })}
          onExit={h.onExit}
        />
      )
    default: {
      const _exhaustive: never = state
      void _exhaustive
      return <Text color={theme.danger}>Unknown state</Text>
    }
  }
}
