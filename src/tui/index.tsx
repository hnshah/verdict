/**
 * Entry point — `verdict tui` renders <App /> via Ink.
 */

import { render } from 'ink'
import { App } from './App.js'

export function startTui(): void {
  // Clear screen on start for a clean slate
  process.stdout.write('\x1Bc')
  render(<App />)
}
