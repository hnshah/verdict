import { describe, expect, it } from 'vitest'
import {
  canGoBack,
  initialDetectProgress,
  initialState,
  isTerminal,
  reduce,
} from '../state-machine.js'
import type {
  OnboardingState,
  Plan,
  Snapshot,
} from '../events.js'

const stubSnapshot: Snapshot = {
  capturedAt: '2026-01-01T00:00:00.000Z',
  hardware: {
    cpu: 'M2',
    cpuCores: 8,
    cpuArch: 'arm64',
    ram: '16 GB',
    ramGB: 16,
    os: 'macOS',
    osVersion: '15.0',
  },
  ollama: { installed: false, daemonRunning: false, installedModels: [] },
  mlx: { appleSilicon: true, mlxLmInstalled: false, serverRunning: false },
  lmstudio: { appInstalled: false, serverRunning: false },
  cloud: { openrouterKey: false, anthropicKey: false, openaiKey: false, groqKey: false },
  config: { exists: false, issues: [] },
  network: { online: true },
  homebrew: { installed: true },
}

const stubPlan: Plan = {
  intent: 'local-first',
  installSteps: [
    { id: 'install-ollama', label: 'brew install ollama', required: true, method: 'brew' },
    { id: 'start-ollama', label: 'ollama serve', required: true },
  ],
  modelsToPull: [
    { name: 'llama3.2:3b', provider: 'ollama', role: 'general-small', paramsB: 3, defaultQuant: 'q4_K_M', estimatedSizeGB: 2 },
    { name: 'qwen2.5:7b', provider: 'ollama', role: 'general-mid', paramsB: 7, defaultQuant: 'q4_K_M', estimatedSizeGB: 4 },
  ],
  cloudModels: [],
  reuseModels: [],
  judge: { modelId: 'llama3.2:3b', rationale: 'smallest local fallback' },
  config: { action: 'create', targetPath: './verdict.yaml' },
  rationale: 'fresh setup',
  estimatedDownloadGB: 6,
  estimatedDurationMin: [3, 8],
}

describe('initialState', () => {
  it('starts at welcome', () => {
    expect(initialState()).toEqual({ kind: 'welcome' })
  })
})

describe('initialDetectProgress', () => {
  it('marks every step pending', () => {
    const p = initialDetectProgress()
    expect(Object.values(p).every(v => v === 'pending')).toBe(true)
    expect(p.hardware).toBe('pending')
    expect(p.config).toBe('pending')
  })
})

describe('reduce: welcome', () => {
  it('next moves to detect', () => {
    const s = reduce({ kind: 'welcome' }, { type: 'next' })
    expect(s.kind).toBe('detect')
  })

  it('skip-onboarding jumps to done', () => {
    const s = reduce({ kind: 'welcome' }, { type: 'skip-onboarding' })
    expect(s.kind).toBe('done')
  })

  it('ignores unrelated events', () => {
    const s = reduce({ kind: 'welcome' }, { type: 'retry' })
    expect(s.kind).toBe('welcome')
  })
})

describe('reduce: detect', () => {
  it('updates progress on __detect-progress', () => {
    const start: OnboardingState = { kind: 'detect', progress: initialDetectProgress() }
    const next = reduce(start, {
      type: '__detect-progress',
      data: { ...initialDetectProgress(), hardware: 'done' },
    })
    expect(next.kind).toBe('detect')
    expect((next as Extract<OnboardingState, { kind: 'detect' }>).progress.hardware).toBe('done')
  })

  it('advances to plan on __detect-complete', () => {
    const start: OnboardingState = { kind: 'detect', progress: initialDetectProgress() }
    const next = reduce(start, {
      type: '__detect-complete',
      snapshot: stubSnapshot,
      plan: stubPlan,
    })
    expect(next.kind).toBe('plan')
  })
})

describe('reduce: plan → consent → install', () => {
  it('plan + next → consent with default selections', () => {
    const planState: OnboardingState = { kind: 'plan', snapshot: stubSnapshot, plan: stubPlan }
    const next = reduce(planState, { type: 'next' })
    expect(next.kind).toBe('consent')
    if (next.kind === 'consent') {
      expect(next.selections.modelsToPull).toEqual(['llama3.2:3b', 'qwen2.5:7b'])
      expect(next.selections.judgeModelId).toBe('llama3.2:3b')
    }
  })

  it('consent + edit-plan updates selections in place', () => {
    const consentState: OnboardingState = {
      kind: 'consent',
      snapshot: stubSnapshot,
      plan: stubPlan,
      selections: { modelsToPull: ['llama3.2:3b'], judgeModelId: 'llama3.2:3b', installMLX: false },
    }
    const next = reduce(consentState, {
      type: 'edit-plan',
      selections: { modelsToPull: ['qwen2.5:7b'], judgeModelId: 'qwen2.5:7b', installMLX: true },
    })
    expect(next.kind).toBe('consent')
    if (next.kind === 'consent') {
      expect(next.selections.modelsToPull).toEqual(['qwen2.5:7b'])
      expect(next.selections.installMLX).toBe(true)
    }
  })

  it('consent + consent-given → install with steps from plan', () => {
    const consentState: OnboardingState = {
      kind: 'consent',
      snapshot: stubSnapshot,
      plan: stubPlan,
      selections: { modelsToPull: ['llama3.2:3b'], judgeModelId: 'llama3.2:3b', installMLX: false },
    }
    const next = reduce(consentState, { type: 'consent-given' })
    expect(next.kind).toBe('install')
    if (next.kind === 'install') {
      expect(next.steps).toHaveLength(2)
      expect(next.steps[0]?.state).toBe('pending')
    }
  })

  it('plan + back → welcome', () => {
    const planState: OnboardingState = { kind: 'plan', snapshot: stubSnapshot, plan: stubPlan }
    expect(reduce(planState, { type: 'back' }).kind).toBe('welcome')
  })

  it('consent + back → plan (carries snapshot)', () => {
    const consentState: OnboardingState = {
      kind: 'consent',
      snapshot: stubSnapshot,
      plan: stubPlan,
      selections: { modelsToPull: [], judgeModelId: '', installMLX: false },
    }
    const next = reduce(consentState, { type: 'back' })
    expect(next.kind).toBe('plan')
    if (next.kind === 'plan') {
      expect(next.snapshot).toBe(stubSnapshot)
    }
  })
})

describe('reduce: install', () => {
  it('records step progress and currentStep', () => {
    const installState: OnboardingState = {
      kind: 'install',
      plan: stubPlan,
      steps: [
        { step: stubPlan.installSteps[0]!, state: 'pending', log: [] },
        { step: stubPlan.installSteps[1]!, state: 'pending', log: [] },
      ],
      currentStep: 0,
    }
    const next = reduce(installState, {
      type: '__install-step-progress',
      index: 0,
      line: 'Installing...',
      state: 'running',
    })
    expect(next.kind).toBe('install')
    if (next.kind === 'install') {
      expect(next.steps[0]?.state).toBe('running')
      expect(next.steps[0]?.log).toEqual(['Installing...'])
      expect(next.currentStep).toBe(0)
    }
  })

  it('marks step failed on __install-step-failed', () => {
    const installState: OnboardingState = {
      kind: 'install',
      plan: stubPlan,
      steps: [{ step: stubPlan.installSteps[0]!, state: 'running', log: [] }],
      currentStep: 0,
    }
    const next = reduce(installState, {
      type: '__install-step-failed',
      index: 0,
      error: 'brew not found',
    })
    if (next.kind === 'install') {
      expect(next.steps[0]?.state).toBe('failed')
      expect(next.steps[0]?.errorMessage).toBe('brew not found')
    }
  })

  it('advances to pull on __install-complete', () => {
    const installState: OnboardingState = {
      kind: 'install',
      plan: stubPlan,
      steps: [],
      currentStep: 0,
    }
    const next = reduce(installState, { type: '__install-complete' })
    expect(next.kind).toBe('pull')
    if (next.kind === 'pull') {
      expect(next.aggregate.totalTasks).toBe(2)
    }
  })
})

describe('reduce: pull → configure → verify', () => {
  it('progress updates tasks + aggregate', () => {
    const pullState: OnboardingState = {
      kind: 'pull',
      plan: stubPlan,
      tasks: {},
      aggregate: { overallPercent: 0, doneTasks: 0, totalTasks: 2, failedTasks: 0 },
    }
    const next = reduce(pullState, {
      type: '__pull-progress',
      tasks: {
        'llama3.2:3b': {
          modelName: 'llama3.2:3b',
          phase: 'downloading',
          percent: 50,
          bytesPerSec: 1_000_000,
          etaSeconds: 30,
          attempt: 1,
        },
      },
      aggregate: { overallPercent: 25, doneTasks: 0, totalTasks: 2, failedTasks: 0 },
    })
    if (next.kind === 'pull') {
      expect(next.aggregate.overallPercent).toBe(25)
      expect(next.tasks['llama3.2:3b']?.phase).toBe('downloading')
    }
  })

  it('pull-complete → configure', () => {
    const pullState: OnboardingState = {
      kind: 'pull',
      plan: stubPlan,
      tasks: {},
      aggregate: { overallPercent: 100, doneTasks: 2, totalTasks: 2, failedTasks: 0 },
    }
    const next = reduce(pullState, { type: '__pull-complete' })
    expect(next.kind).toBe('configure')
    if (next.kind === 'configure') {
      expect(next.action).toBe('create')
    }
  })

  it('configure-written → verify', () => {
    const configureState: OnboardingState = {
      kind: 'configure',
      previewYaml: 'yaml',
      diff: null,
      hasExisting: false,
      action: 'create',
    }
    const next = reduce(configureState, {
      type: '__configure-written',
      configPath: './verdict.yaml',
    })
    expect(next.kind).toBe('verify')
  })
})

describe('reduce: universal cancel + error', () => {
  it('cancel from any state → cancelled with `from`', () => {
    const planState: OnboardingState = { kind: 'plan', snapshot: stubSnapshot, plan: stubPlan }
    const next = reduce(planState, { type: 'cancel' })
    expect(next.kind).toBe('cancelled')
    if (next.kind === 'cancelled') {
      expect(next.from).toBe('plan')
    }
  })

  it('cancel from cancelled → cancelled (idempotent, preserves from)', () => {
    const cancelled: OnboardingState = { kind: 'cancelled', from: 'pull' }
    const next = reduce(cancelled, { type: 'cancel' })
    if (next.kind === 'cancelled') {
      expect(next.from).toBe('pull')
    }
  })

  it('__error from install → failed with from=install', () => {
    const installState: OnboardingState = {
      kind: 'install',
      plan: stubPlan,
      steps: [],
      currentStep: 0,
    }
    const next = reduce(installState, {
      type: '__error',
      error: 'kaboom',
      recoverable: false,
    })
    expect(next.kind).toBe('failed')
    if (next.kind === 'failed') {
      expect(next.from).toBe('install')
      expect(next.recoverable).toBe(false)
    }
  })
})

describe('helpers', () => {
  it('canGoBack: only from plan and consent', () => {
    expect(canGoBack({ kind: 'welcome' })).toBe(false)
    expect(canGoBack({ kind: 'plan', snapshot: stubSnapshot, plan: stubPlan })).toBe(true)
    expect(
      canGoBack({
        kind: 'consent',
        snapshot: stubSnapshot,
        plan: stubPlan,
        selections: { modelsToPull: [], judgeModelId: '', installMLX: false },
      })
    ).toBe(true)
    expect(canGoBack({ kind: 'install', plan: stubPlan, steps: [], currentStep: 0 })).toBe(false)
  })

  it('isTerminal: done/cancelled/failed only', () => {
    expect(isTerminal({ kind: 'done', summary: { pulledModels: [], reusedModels: [], configPath: '', totalDurationMs: 0 } })).toBe(true)
    expect(isTerminal({ kind: 'cancelled', from: 'welcome' })).toBe(true)
    expect(isTerminal({ kind: 'failed', from: 'install', error: 'x', recoverable: true })).toBe(true)
    expect(isTerminal({ kind: 'welcome' })).toBe(false)
  })
})
