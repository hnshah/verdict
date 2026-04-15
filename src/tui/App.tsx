/**
 * Root TUI component. Holds global keymap + screen router + overlays
 * (palette, help). Individual screens are mounted based on state.screen.
 */

import { useState } from 'react'
import { Box } from 'ink'
import { useKeymap } from './hooks/useKeymap.js'
import type { Screen } from './hooks/useKeymap.js'
import { Layout } from './components/Layout.js'
import { Palette, defaultCommands } from './components/Palette.js'
import { HelpOverlay } from './components/HelpOverlay.js'
import { Home } from './screens/Home.js'
import { Runs } from './screens/Runs.js'
import { RunDetail } from './screens/RunDetail.js'
import { LiveRun } from './screens/LiveRun.js'
import { NewRun } from './screens/NewRun.js'
import { Models } from './screens/Models.js'
import { Baselines } from './screens/Baselines.js'
import { Compare } from './screens/Compare.js'
import { Daemon } from './screens/Daemon.js'
import { EvalPacks } from './screens/EvalPacks.js'
import { ConfigEditor } from './screens/ConfigEditor.js'
import { Router } from './screens/Router.js'
import { Serve } from './screens/Serve.js'
import type { EvalHistoryRow } from '../db/client.js'

export function App() {
  const { state, dispatch } = useKeymap()
  const [detailRow, setDetailRow] = useState<EvalHistoryRow | null>(null)

  const goto = (screen: Screen) => dispatch({ type: 'set-screen', screen })

  const commands = defaultCommands(goto)

  const renderScreen = () => {
    switch (state.screen) {
      case 'home':
        return <Home />
      case 'runs':
        return (
          <Runs
            mode={state.mode}
            filterQuery={state.filterQuery}
            onFilterChange={(q) => dispatch({ type: 'set-filter-query', q })}
            onExitFilter={() => dispatch({ type: 'set-mode', mode: 'normal' })}
            onOpenRun={(row) => { setDetailRow(row); goto('run-detail') }}
            onStartLiveRun={() => goto('new-run')}
          />
        )
      case 'run-detail':
        return detailRow
          ? <RunDetail row={detailRow} onBack={() => goto('runs')} />
          : <Runs
              mode={state.mode}
              filterQuery={state.filterQuery}
              onFilterChange={(q) => dispatch({ type: 'set-filter-query', q })}
              onExitFilter={() => dispatch({ type: 'set-mode', mode: 'normal' })}
              onOpenRun={(row) => { setDetailRow(row); goto('run-detail') }}
              onStartLiveRun={() => goto('new-run')}
            />
      case 'live-run':    return <LiveRun onBack={() => goto('home')} />
      case 'new-run':     return <NewRun onBack={() => goto('home')} />
      case 'models':      return <Models onBack={() => goto('home')} />
      case 'baselines':   return <Baselines onBack={() => goto('home')} />
      case 'compare':     return <Compare onBack={() => goto('home')} />
      case 'daemon':      return <Daemon onBack={() => goto('home')} />
      case 'eval-packs':  return <EvalPacks onBack={() => goto('home')} />
      case 'config':      return <ConfigEditor onBack={() => goto('home')} />
      case 'router':      return <Router onBack={() => goto('home')} />
      case 'serve':       return <Serve onBack={() => goto('home')} />
      default:            return <Home />
    }
  }

  // `themeTick` is read so React sees it and rerenders children that import
  // the mutable theme object after it's been updated in place.
  void state.themeTick

  return (
    <Layout
      screen={state.screen}
      mode={state.mode}
      toast={state.toast}
    >
      {renderScreen()}
      {state.mode === 'command' && (
        <Box marginTop={1}>
          <Palette
            commands={commands}
            onClose={() => dispatch({ type: 'reset' })}
          />
        </Box>
      )}
      {state.mode === 'help' && (
        <Box marginTop={1}>
          <HelpOverlay
            screen={state.screen}
            onClose={() => dispatch({ type: 'reset' })}
          />
        </Box>
      )}
    </Layout>
  )
}
