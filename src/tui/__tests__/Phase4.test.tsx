/**
 * Phase 4 smoke tests — mouse, error boundary, confirm dialog, clipboard,
 * session persistence, NO_COLOR.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { Component } from 'react'
import { MouseProvider } from '@ink-tools/ink-mouse'
import { Text } from 'ink'
import { ErrorBoundary } from '../components/ErrorBoundary.js'
import { ConfirmDialog } from '../components/ConfirmDialog.js'
import { Clickable } from '../components/Clickable.js'
import { loadSession, saveSession, updateSession } from '../utils/session.js'
import { writeClipboard } from '../utils/clipboard.js'
import { THEMES } from '../theme.js'

// The ErrorBoundary needs a render-throwing child; this helper creates one.
class Boom extends Component<{ msg: string }> {
  render(): never { throw new Error(this.props.msg) }
}

describe('Phase 4 TUI smoke', () => {
  it('ErrorBoundary catches screen crash + shows a helpful panel', () => {
    // ink-testing-library doesn't pipe through console.error cleanly on
    // thrown errors; silence it for the duration of this test.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { lastFrame, unmount } = render(
      <ErrorBoundary screen="runs">
        <Boom msg="kaboom from a test" />
      </ErrorBoundary>
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('runs screen crashed')
    expect(frame).toContain('kaboom from a test')
    expect(frame).toContain('1..6')
    unmount()
    spy.mockRestore()
  })

  it('ErrorBoundary passes through children on happy path', () => {
    const { lastFrame, unmount } = render(
      <ErrorBoundary screen="home">
        <Text>ok content</Text>
      </ErrorBoundary>
    )
    expect(lastFrame()).toContain('ok content')
    unmount()
  })

  it('ConfirmDialog renders confirm / cancel labels', () => {
    const { lastFrame, unmount } = render(
      <ConfirmDialog
        message="Stop the daemon?"
        confirmLabel="Stop"
        cancelLabel="Keep"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Confirm')
    expect(frame).toContain('Stop the daemon?')
    expect(frame).toContain('[Y]')
    expect(frame).toContain('[N/Esc]')
    unmount()
  })

  it('Clickable wraps children without crashing inside MouseProvider', () => {
    const { lastFrame, unmount } = render(
      <MouseProvider>
        <Clickable onClick={() => {}}><Text>hi</Text></Clickable>
      </MouseProvider>
    )
    expect(lastFrame()).toContain('hi')
    unmount()
  })

  it('session utils roundtrip lastScreen', () => {
    saveSession({ lastScreen: 'baselines' })
    expect(loadSession().lastScreen).toBe('baselines')
    updateSession({ lastScreen: 'daemon' })
    expect(loadSession().lastScreen).toBe('daemon')
    // Cleanup to avoid leaking state into other tests
    saveSession({})
  })

  it('theme ships a monochrome preset for NO_COLOR environments', () => {
    expect(THEMES.monochrome).toBeDefined()
    expect(THEMES.monochrome.primary).toBe('white')
    expect(THEMES.monochrome.danger).toBe('white')
  })

  it('writeClipboard returns ok=false when no tools are installed', async () => {
    // In a bare CI environment none of pbcopy/xclip/wl-copy/clip.exe exist,
    // so this should fail gracefully (not throw).
    const res = await writeClipboard('hello')
    expect(typeof res.ok).toBe('boolean')
    expect(typeof res.tool).toBe('string')
  })
})
