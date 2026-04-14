/**
 * Color tokens used across the TUI. Single source of truth so the theme
 * can be swapped later (monokai, dracula, etc) without combing files.
 */
export const theme = {
  primary: 'cyan',
  accent: 'magenta',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  muted: 'gray',
  dim: 'gray',
  text: 'white',
  highlight: 'cyanBright',
  // semantic
  border: 'cyan',
  borderDim: 'gray',
  winner: 'green',
  regression: 'red',
} as const

export type ThemeColor = typeof theme[keyof typeof theme]

/** Score → color band, same buckets used in src/reporter/terminal.ts. */
export function scoreColor(score: number): ThemeColor {
  if (score >= 8) return theme.success
  if (score >= 6) return theme.warning
  if (score >= 3) return 'yellow'
  return theme.danger
}
