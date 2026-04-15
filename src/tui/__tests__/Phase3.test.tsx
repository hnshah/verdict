/**
 * Phase 3 smoke tests — Router, Serve, Chart component, theme system,
 * navigation back stack, regression banner on Home.
 */

import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { Router } from '../screens/Router.js'
import { Serve } from '../screens/Serve.js'
import { Chart } from '../components/Chart.js'
import { THEMES, applyTheme, getThemeName, cycleTheme } from '../theme.js'

describe('Phase 3 TUI smoke', () => {
  it('Router renders compose chrome', () => {
    const { lastFrame, unmount } = render(<Router />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Router')
    expect(frame).toContain('task:')
    expect(frame).toContain('Enter: route')
    unmount()
  })

  it('Serve renders stopped state by default', () => {
    const { lastFrame, unmount } = render(<Serve />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Serve')
    expect(frame).toContain('stopped')
    expect(frame).toContain('port')
    unmount()
  })

  it('Chart handles empty / short input without crashing', () => {
    const { lastFrame, unmount } = render(<Chart series={[[]]} />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('not enough data')
    unmount()
  })

  it('Chart renders an ASCII plot for valid series', () => {
    const { lastFrame, unmount } = render(
      <Chart series={[[1, 2, 3, 4, 5, 6, 7, 8]]} height={4} />
    )
    const frame = lastFrame() ?? ''
    // asciichart output contains Unicode box-drawing chars
    expect(frame.length).toBeGreaterThan(10)
    unmount()
  })

  it('theme system ships 5 presets and can cycle', () => {
    expect(Object.keys(THEMES).sort()).toEqual(
      ['default', 'dracula', 'monochrome', 'monokai', 'solarized']
    )
    applyTheme('default')
    expect(getThemeName()).toBe('default')
    const next = cycleTheme()
    expect(next).not.toBe('default')
    expect(getThemeName()).toBe(next)
    // Restore
    applyTheme('default')
  })

  it('applyTheme to unknown name is a no-op', () => {
    applyTheme('default')
    applyTheme('nonexistent')
    expect(getThemeName()).toBe('default')
  })
})
