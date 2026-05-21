/**
 * Pure reducer for the onboarding state machine. No side effects — the
 * engine layer (src/onboarding/index.ts) wraps this reducer and drives
 * the side-effectful work (detect, install, pull, configure, verify).
 *
 * Design rules:
 *  - `back` is only permitted up to `consent`. Once `install` starts, we
 *    can't cleanly reverse the side effects (Homebrew, daemons, partial
 *    blobs), so we disallow back from there.
 *  - `cancel` is allowed from any state, including failed/cancelled
 *    (idempotent).
 *  - Internal events (prefixed `__`) come from the engine's async work
 *    and drive forward transitions.
 *  - Unknown event types in a given state are no-ops (defensive — easier
 *    to evolve event union without breaking older callers).
 */

import type {
  DetectProgress,
  DetectStep,
  InstallStepProgress,
  OnboardingEvent,
  OnboardingState,
  OnboardingStateKind,
  Plan,
  PlanSelections,
} from './events.js'

export function initialState(): OnboardingState {
  return { kind: 'welcome' }
}

export function initialDetectProgress(): DetectProgress {
  const steps: DetectStep[] = [
    'hardware',
    'ollama-bin',
    'ollama-daemon',
    'mlx',
    'lmstudio',
    'cloud',
    'network',
    'homebrew',
    'config',
  ]
  return steps.reduce(
    (acc, s) => ({ ...acc, [s]: 'pending' as const }),
    {} as DetectProgress
  )
}

function defaultSelectionsFor(plan: Plan): PlanSelections {
  return {
    modelsToPull: plan.modelsToPull.map(m => m.name),
    judgeModelId: plan.judge.modelId,
    installMLX: false,
  }
}

/**
 * Transitions that go to `cancelled` from anywhere. Idempotent — `cancel`
 * on an already-cancelled state stays cancelled with the same `from`.
 */
function cancelFrom(state: OnboardingState, reason?: string): OnboardingState {
  const from: OnboardingStateKind =
    state.kind === 'cancelled' || state.kind === 'failed' ? state.from : state.kind
  return { kind: 'cancelled', from, reason }
}

export function reduce(
  state: OnboardingState,
  event: OnboardingEvent
): OnboardingState {
  // Universal cancel.
  if (event.type === 'cancel') return cancelFrom(state, event.reason)

  // Universal error.
  if (event.type === '__error') {
    const from: OnboardingStateKind =
      state.kind === 'cancelled' || state.kind === 'failed' ? state.from : state.kind
    return { kind: 'failed', from, error: event.error, recoverable: event.recoverable }
  }

  switch (state.kind) {
    // ─── welcome ────────────────────────────────────────────────────
    case 'welcome': {
      if (event.type === 'next') {
        return { kind: 'detect', progress: initialDetectProgress() }
      }
      if (event.type === 'skip-onboarding') {
        // The engine catches this and writes mark.status = 'skipped',
        // then advances to done with an empty summary.
        return {
          kind: 'done',
          summary: {
            pulledModels: [],
            reusedModels: [],
            configPath: '',
            totalDurationMs: 0,
          },
        }
      }
      return state
    }

    // ─── detect ─────────────────────────────────────────────────────
    case 'detect': {
      if (event.type === '__detect-progress') {
        return { ...state, progress: event.data }
      }
      if (event.type === '__detect-complete') {
        return { kind: 'plan', snapshot: event.snapshot, plan: event.plan }
      }
      return state
    }

    // ─── plan ───────────────────────────────────────────────────────
    case 'plan': {
      if (event.type === 'next') {
        return {
          kind: 'consent',
          snapshot: state.snapshot,
          plan: state.plan,
          selections: defaultSelectionsFor(state.plan),
        }
      }
      if (event.type === 'edit-plan') {
        return {
          kind: 'consent',
          snapshot: state.snapshot,
          plan: state.plan,
          selections: event.selections,
        }
      }
      if (event.type === 'back') {
        return { kind: 'welcome' }
      }
      return state
    }

    // ─── consent ────────────────────────────────────────────────────
    case 'consent': {
      if (event.type === 'edit-plan') {
        return { ...state, selections: event.selections }
      }
      if (event.type === 'consent-given' || event.type === 'next') {
        const steps: InstallStepProgress[] = state.plan.installSteps.map(s => ({
          step: s,
          state: 'pending',
          log: [],
        }))
        return {
          kind: 'install',
          plan: state.plan,
          steps,
          currentStep: 0,
        }
      }
      if (event.type === 'back') {
        return { kind: 'plan', snapshot: state.snapshot, plan: state.plan }
      }
      return state
    }

    // ─── install ────────────────────────────────────────────────────
    case 'install': {
      if (event.type === '__install-step-progress') {
        const next = state.steps.slice()
        const cur = next[event.index]
        if (cur) {
          next[event.index] = {
            ...cur,
            state: event.state,
            log: event.line ? [...cur.log, event.line] : cur.log,
          }
        }
        return { ...state, steps: next, currentStep: event.index }
      }
      if (event.type === '__install-step-failed') {
        const next = state.steps.slice()
        const cur = next[event.index]
        if (cur) {
          next[event.index] = {
            ...cur,
            state: 'failed',
            errorMessage: event.error,
          }
        }
        return { ...state, steps: next, currentStep: event.index }
      }
      if (event.type === '__install-complete') {
        return {
          kind: 'pull',
          plan: state.plan,
          tasks: {},
          aggregate: {
            overallPercent: 0,
            doneTasks: 0,
            totalTasks: state.plan.modelsToPull.length,
            failedTasks: 0,
          },
        }
      }
      return state
    }

    // ─── pull ───────────────────────────────────────────────────────
    case 'pull': {
      if (event.type === '__pull-progress') {
        return { ...state, tasks: event.tasks, aggregate: event.aggregate }
      }
      if (event.type === '__pull-complete') {
        return {
          kind: 'configure',
          previewYaml: '',
          diff: null,
          hasExisting: false,
          action: state.plan.config.action,
        }
      }
      return state
    }

    // ─── configure ──────────────────────────────────────────────────
    case 'configure': {
      if (event.type === '__configure-ready') {
        return {
          ...state,
          previewYaml: event.previewYaml,
          diff: event.diff,
          hasExisting: event.hasExisting,
        }
      }
      if (event.type === 'choose-config-action') {
        return { ...state, action: event.action }
      }
      if (event.type === '__configure-written') {
        return { kind: 'verify', result: null }
      }
      return state
    }

    // ─── verify ─────────────────────────────────────────────────────
    case 'verify': {
      if (event.type === '__verify-complete') {
        return { kind: 'verify', result: event.result }
      }
      if (event.type === '__first-run-start') {
        return { kind: 'first-run', view: event.view, result: null }
      }
      // Verify result presented; user advances by `next`. Engine then
      // constructs the done summary.
      return state
    }

    // ─── first-run ──────────────────────────────────────────────────
    case 'first-run': {
      if (event.type === '__first-run-progress') {
        return { ...state, view: event.view }
      }
      if (event.type === '__first-run-complete') {
        return { ...state, result: event.result }
      }
      return state
    }

    // ─── done / cancelled / failed ──────────────────────────────────
    case 'done':
      return state

    case 'cancelled':
      if (event.type === 'retry') {
        return { kind: 'welcome' }
      }
      return state

    case 'failed':
      if (event.type === 'retry') {
        // Snap back to the failing state's kind. The engine restores any
        // needed context (snapshot/plan) from the mark file.
        return { kind: 'welcome' }
      }
      return state

    default: {
      const exhaustive: never = state
      void exhaustive
      return state
    }
  }
}

/**
 * Whether the current state allows the user to "go back" to the previous
 * step. Once installation begins, side effects make `back` unsafe.
 */
export function canGoBack(state: OnboardingState): boolean {
  return state.kind === 'plan' || state.kind === 'consent'
}

/**
 * Whether the state is a terminal state (no further transitions except
 * cancel/retry).
 */
export function isTerminal(state: OnboardingState): boolean {
  return state.kind === 'done' || state.kind === 'cancelled' || state.kind === 'failed'
}
