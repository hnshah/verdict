/**
 * Centralized keymap reducer for vim-style TUI modes.
 *
 * Modes:
 *  - normal   — hjkl navigation, screen-level shortcuts
 *  - insert   — text input (form fields, search)
 *  - command  — ':' palette open, fuzzy match commands
 *  - filter   — '/' filter open on a list
 *  - help     — '?' help overlay visible
 */

import { useReducer, useEffect } from 'react'
import { useInput, useApp } from 'ink'
import { cycleTheme } from '../theme.js'

export type Mode = 'normal' | 'insert' | 'command' | 'filter' | 'help'

export type Screen =
  | 'home'
  | 'runs'
  | 'run-detail'
  | 'live-run'
  | 'new-run'
  | 'models'
  | 'baselines'
  | 'compare'
  | 'daemon'
  | 'eval-packs'
  | 'config'
  | 'router'
  | 'serve'

export interface KeymapState {
  mode: Mode
  screen: Screen
  history: Screen[]       // back stack
  paletteQuery: string
  filterQuery: string
  themeTick: number       // bumps on theme change to force rerender
  toast: string | null    // ephemeral status line (e.g. "theme: monokai")
}

export type Action =
  | { type: 'set-mode'; mode: Mode }
  | { type: 'set-screen'; screen: Screen }
  | { type: 'back' }
  | { type: 'set-palette-query'; q: string }
  | { type: 'set-filter-query'; q: string }
  | { type: 'bump-theme'; toast?: string }
  | { type: 'toast'; message: string | null }
  | { type: 'reset' }

const initial: KeymapState = {
  mode: 'normal',
  screen: 'home',
  history: [],
  paletteQuery: '',
  filterQuery: '',
  themeTick: 0,
  toast: null,
}

function reducer(state: KeymapState, action: Action): KeymapState {
  switch (action.type) {
    case 'set-mode':
      return { ...state, mode: action.mode }
    case 'set-screen':
      if (action.screen === state.screen) return state
      return {
        ...state,
        screen: action.screen,
        mode: 'normal',
        filterQuery: '',
        history: [...state.history, state.screen].slice(-20),
      }
    case 'back': {
      const prev = state.history[state.history.length - 1]
      if (!prev) return state
      return {
        ...state,
        screen: prev,
        mode: 'normal',
        filterQuery: '',
        history: state.history.slice(0, -1),
      }
    }
    case 'set-palette-query':
      return { ...state, paletteQuery: action.q }
    case 'set-filter-query':
      return { ...state, filterQuery: action.q }
    case 'bump-theme':
      return { ...state, themeTick: state.themeTick + 1, toast: action.toast ?? null }
    case 'toast':
      return { ...state, toast: action.message }
    case 'reset':
      return { ...state, mode: 'normal', paletteQuery: '', filterQuery: '' }
    default:
      return state
  }
}

/**
 * Global keymap — handles :, /, ?, q (quit), t (theme), Ctrl-o (back), and
 * screen-level routing. Individual screens can consume useInput() additionally
 * to handle pane-local keys (hjkl etc).
 */
export function useKeymap() {
  const [state, dispatch] = useReducer(reducer, initial)
  const { exit } = useApp()

  useInput((input, key) => {
    // Global escape returns to normal mode
    if (key.escape) {
      dispatch({ type: 'reset' })
      return
    }
    // Global exit (only in normal mode, to avoid eating q in search)
    if (state.mode === 'normal' && (input === 'q' || (key.ctrl && input === 'c'))) {
      exit()
      return
    }
    // Route openers
    if (state.mode === 'normal') {
      if (input === ':') {
        dispatch({ type: 'set-mode', mode: 'command' })
        return
      }
      if (input === '/') {
        dispatch({ type: 'set-mode', mode: 'filter' })
        return
      }
      if (input === '?') {
        dispatch({ type: 'set-mode', mode: 'help' })
        return
      }
      // Theme cycle
      if (input === 't') {
        const next = cycleTheme()
        dispatch({ type: 'bump-theme', toast: `theme: ${next}` })
        return
      }
      // Back stack (Ctrl-o)
      if (key.ctrl && input === 'o') {
        dispatch({ type: 'back' })
        return
      }
      // Number-key screen jumps (lazygit-style)
      if (input === '1') dispatch({ type: 'set-screen', screen: 'home' })
      if (input === '2') dispatch({ type: 'set-screen', screen: 'runs' })
      if (input === '3') dispatch({ type: 'set-screen', screen: 'models' })
      if (input === '4') dispatch({ type: 'set-screen', screen: 'baselines' })
      if (input === '5') dispatch({ type: 'set-screen', screen: 'daemon' })
      if (input === '6') dispatch({ type: 'set-screen', screen: 'eval-packs' })
    }
  })

  // Auto-clear toast after 2.5s
  useEffect(() => {
    if (!state.toast) return
    const t = setTimeout(() => dispatch({ type: 'toast', message: null }), 2500)
    return () => clearTimeout(t)
  }, [state.toast])

  return { state, dispatch }
}
