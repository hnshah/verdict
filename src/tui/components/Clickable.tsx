/**
 * Small wrapper around @ink-tools/ink-mouse that makes a Box clickable
 * and optionally scrollable, with a thin callback API.
 *
 * Components use it like:
 *
 *   <Clickable onClick={() => goto('home')}>
 *     <Text>Home</Text>
 *   </Clickable>
 *
 * The underlying Ink Box still renders; the ref-based event binding is
 * invisible to the layout.
 */

import { useRef } from 'react'
import { Box, type DOMElement } from 'ink'
import { useOnClick, useOnWheel, type InkMouseEvent } from '@ink-tools/ink-mouse'

export interface ClickableProps {
  children: React.ReactNode
  onClick?: (event: InkMouseEvent) => void
  onWheelUp?: () => void
  onWheelDown?: () => void
}

export function Clickable({ children, onClick, onWheelUp, onWheelDown }: ClickableProps) {
  const ref = useRef<DOMElement>(null)
  useOnClick(ref, onClick ?? null)
  useOnWheel(ref, (event) => {
    // xterm-mouse uses negative deltaY for up, positive for down (scroll down)
    // The library exposes `.direction` in MouseEvent — fall back to raw button
    // codes 64 (up) / 65 (down) from SGR mouse protocol.
    const anyEvent = event as InkMouseEvent & { button?: number; direction?: 'up' | 'down' }
    const dir = anyEvent.direction ?? (anyEvent.button === 64 ? 'up' : 'down')
    if (dir === 'up') onWheelUp?.()
    else onWheelDown?.()
  })
  return <Box ref={ref}>{children}</Box>
}
