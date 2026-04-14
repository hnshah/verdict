/**
 * Phase 2 smoke tests — render each new screen and assert key labels.
 */

import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { Daemon } from '../screens/Daemon.js'
import { Baselines } from '../screens/Baselines.js'
import { Compare } from '../screens/Compare.js'
import { EvalPacks } from '../screens/EvalPacks.js'
import { NewRun } from '../screens/NewRun.js'
import { ConfigEditor } from '../screens/ConfigEditor.js'
import { DiffPane } from '../components/DiffPane.js'
import type { BaselineComparison } from '../../types/index.js'

describe('Phase 2 TUI smoke', () => {
  it('Daemon renders status + log panels', () => {
    const { lastFrame, unmount } = render(<Daemon />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Daemon')
    expect(frame).toContain('Log tail')
    unmount()
  })

  it('Baselines renders header + hint', () => {
    const { lastFrame, unmount } = render(<Baselines />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Baselines')
    expect(frame).toContain('save latest')
    unmount()
  })

  it('Compare renders pick-A prompt', () => {
    const { lastFrame, unmount } = render(<Compare />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Compare')
    expect(frame).toContain('Pick result A')
    unmount()
  })

  it('EvalPacks renders header', () => {
    const { lastFrame, unmount } = render(<EvalPacks />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Eval packs')
    unmount()
  })

  it('NewRun renders wizard chrome', () => {
    const { lastFrame, unmount } = render(<NewRun />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('New run')
    expect(frame).toContain('toggle')
    unmount()
  })

  it('ConfigEditor renders loading or error state', () => {
    const { lastFrame, unmount } = render(<ConfigEditor />)
    const frame = lastFrame() ?? ''
    // Either loading, or shows config/header if verdict.yaml exists in cwd
    expect(frame.length).toBeGreaterThan(0)
    unmount()
  })

  it('DiffPane renders headers and deltas', () => {
    const cmp: BaselineComparison = {
      baselineName: 'base-a',
      baselineDate: '2026-04-14',
      deltas: [
        { model: 'qwen-7b', scoreA: 7.5, scoreB: 8.0, delta: 0.5, pctChange: 6.7, regression: false },
        { model: 'llama-3', scoreA: 8.2, scoreB: 7.5, delta: -0.7, pctChange: -8.5, regression: true },
      ],
      newModels: ['gpt-4o'],
      removedModels: [],
      regressionAlert: true,
    }
    const { lastFrame, unmount } = render(<DiffPane comparison={cmp} />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('qwen-7b')
    expect(frame).toContain('llama-3')
    expect(frame).toContain('Regression detected')
    expect(frame).toContain('gpt-4o')
    unmount()
  })
})
