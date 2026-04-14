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

export type Mode = 'normal' | 'insert' | 'command' | 'filter' | 'help'

export interface KeymapState {
  mode: Mode
  screen: Screen
  paletteQuery: string
  filterQuery: string
}

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

export type Action =
  | { type: 'set-mode'; mode: Mode }
  | { type: 'set-screen'; screen: Screen }
  | { type: 'set-palette-query'; q: string }
  | { type: 'set-filter-query'; q: string }
  | { type: 'reset' }

const initial: KeymapState = {
  mode: 'normal',
  screen: 'home',
  paletteQuery: '',
  filterQuery: '',
}

function reducer(state: KeymapState, action: Action): KeymapState {
  switch (action.type) {
    case 'set-mode':
      return { ...state, mode: action.mode }
    case 'set-screen':
      return { ...state, screen: action.screen, mode: 'normal', filterQuery: '' }
    case 'set-palette-query':
      return { ...state, paletteQuery: action.q }
    case 'set-filter-query':
      return { ...state, filterQuery: action.q }
    case 'reset':
      return { ...state, mode: 'normal', paletteQuery: '', filterQuery: '' }
    default:
      return state
  }
}

/**
 * Global keymap — handles :, /, ?, q (quit), g (go), and screen-level
 * routing. Individual screens can consume useInput() additionally to handle
 * pane-local keys (hjkl etc).
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
      // Number-key screen jumps (lazygit-style)
      if (input === '1') dispatch({ type: 'set-screen', screen: 'home' })
      if (input === '2') dispatch({ type: 'set-screen', screen: 'runs' })
      if (input === '3') dispatch({ type: 'set-screen', screen: 'models' })
      if (input === '4') dispatch({ type: 'set-screen', screen: 'baselines' })
      if (input === '5') dispatch({ type: 'set-screen', screen: 'daemon' })
      if (input === '6') dispatch({ type: 'set-screen', screen: 'eval-packs' })
    }
  })

  useEffect(() => {
    // Noop — placeholder for future effects (e.g. hide cursor)
  }, [])

  return { state, dispatch }
}
