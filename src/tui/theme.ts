/**
 * Theme system.
 *
 * Ships four presets — default, monokai, dracula, solarized — chosen by
 * name and persisted to ~/.verdict/tui-theme.json. The mutable `theme`
 * export starts as the active preset and is rewritten by applyTheme()
 * when the user cycles themes (`t` on any screen).
 *
 * Keeping `theme` as a mutable record (rather than React context) means
 * existing code that does `<Text color={theme.primary}>` keeps working
 * without threading a provider through the tree. Ink re-renders on the
 * next state change after applyTheme() runs.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

export type ThemeColor = string

export interface ThemePalette {
  primary:     ThemeColor
  accent:      ThemeColor
  success:     ThemeColor
  warning:     ThemeColor
  danger:      ThemeColor
  muted:       ThemeColor
  dim:         ThemeColor
  text:        ThemeColor
  highlight:   ThemeColor
  border:      ThemeColor
  borderDim:   ThemeColor
  winner:      ThemeColor
  regression:  ThemeColor
}

const DEFAULT: ThemePalette = {
  primary:    'cyan',
  accent:     'magenta',
  success:    'green',
  warning:    'yellow',
  danger:     'red',
  muted:      'gray',
  dim:        'gray',
  text:       'white',
  highlight:  'cyanBright',
  border:     'cyan',
  borderDim:  'gray',
  winner:     'green',
  regression: 'red',
}

const MONOKAI: ThemePalette = {
  primary:    '#66d9ef',
  accent:     '#f92672',
  success:    '#a6e22e',
  warning:    '#e6db74',
  danger:     '#f92672',
  muted:      '#75715e',
  dim:        '#75715e',
  text:       '#f8f8f2',
  highlight:  '#fd971f',
  border:     '#66d9ef',
  borderDim:  '#49483e',
  winner:     '#a6e22e',
  regression: '#f92672',
}

const DRACULA: ThemePalette = {
  primary:    '#8be9fd',
  accent:     '#ff79c6',
  success:    '#50fa7b',
  warning:    '#f1fa8c',
  danger:     '#ff5555',
  muted:      '#6272a4',
  dim:        '#44475a',
  text:       '#f8f8f2',
  highlight:  '#bd93f9',
  border:     '#6272a4',
  borderDim:  '#44475a',
  winner:     '#50fa7b',
  regression: '#ff5555',
}

const SOLARIZED: ThemePalette = {
  primary:    '#268bd2',
  accent:     '#d33682',
  success:    '#859900',
  warning:    '#b58900',
  danger:     '#dc322f',
  muted:      '#586e75',
  dim:        '#657b83',
  text:       '#eee8d5',
  highlight:  '#cb4b16',
  border:     '#268bd2',
  borderDim:  '#586e75',
  winner:     '#859900',
  regression: '#dc322f',
}

export const THEMES: Record<string, ThemePalette> = {
  default:   DEFAULT,
  monokai:   MONOKAI,
  dracula:   DRACULA,
  solarized: SOLARIZED,
}

export const THEME_NAMES = Object.keys(THEMES) as (keyof typeof THEMES)[]

const CONFIG_PATH = path.join(os.homedir(), '.verdict', 'tui-theme.json')

function loadPersisted(): string {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as { name?: string }
    if (raw.name && THEMES[raw.name]) return raw.name
  } catch { /* ignore */ }
  return 'default'
}

function persist(name: string): void {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ name }, null, 2))
  } catch { /* best-effort */ }
}

let _activeName: string = loadPersisted()

/** Mutable palette — imported all over the codebase. */
export const theme: ThemePalette = { ...THEMES[_activeName] }

export function getThemeName(): string { return _activeName }

/** Change theme + persist. Triggers a rerender when caller sets state. */
export function applyTheme(name: string): void {
  const next = THEMES[name]
  if (!next) return
  _activeName = name
  Object.assign(theme, next)
  persist(name)
}

export function cycleTheme(): string {
  const i = THEME_NAMES.indexOf(_activeName as typeof THEME_NAMES[number])
  const next = THEME_NAMES[(i + 1) % THEME_NAMES.length]
  applyTheme(next)
  return next
}

/** Score → color band, same buckets used in src/reporter/terminal.ts. */
export function scoreColor(score: number): ThemeColor {
  if (score >= 8) return theme.success
  if (score >= 6) return theme.warning
  if (score >= 3) return 'yellow'
  return theme.danger
}
