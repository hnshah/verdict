/**
 * `verdict tui` — opens the interactive TUI.
 */

export async function tuiCommand(): Promise<void> {
  // Dynamic import so the CLI start-up stays fast for non-TUI commands.
  // Also avoids loading Ink/React into contexts that only want `verdict run`.
  const { startTui } = await import('../../tui/index.js')
  startTui()
}
