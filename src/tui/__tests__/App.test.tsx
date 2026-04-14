/**
 * Smoke tests — render each screen via ink-testing-library and assert
 * nothing crashes + key chrome is present.
 */

import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { App } from '../App.js'
import { Home } from '../screens/Home.js'
import { Layout } from '../components/Layout.js'
import { HelpOverlay } from '../components/HelpOverlay.js'

describe('TUI smoke', () => {
  it('renders App with header chrome', () => {
    const { lastFrame, unmount } = render(<App />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('verdict')
    expect(frame).toContain('Home')
    unmount()
  })

  it('renders Home screen directly', () => {
    const { lastFrame, unmount } = render(<Home />)
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Top models')
    expect(frame).toContain('Daemon')
    unmount()
  })

  it('Layout renders footer hints', () => {
    const { lastFrame, unmount } = render(
      <Layout screen="home" mode="normal">
        <></>
      </Layout>
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain(':')
    expect(frame).toContain('cmd')
    expect(frame).toContain('quit')
    unmount()
  })

  it('HelpOverlay lists global keys', () => {
    const { lastFrame, unmount } = render(
      <HelpOverlay screen="home" onClose={() => {}} />
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Command palette')
    expect(frame).toContain('Filter visible list')
    unmount()
  })
})
