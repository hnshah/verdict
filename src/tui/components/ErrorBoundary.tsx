/**
 * Error boundary so one crashing screen doesn't kill the entire TUI.
 *
 * React's error boundary is class-only; this is the minimal implementation
 * that catches render errors, shows a readable error pane, and lets the
 * user press any key (via parent's useInput) to keep navigating.
 */

import { Component, type ReactNode } from 'react'
import { Box, Text } from 'ink'
import { theme } from '../theme.js'

interface Props {
  screen: string
  children: ReactNode
  onReset?: () => void
}

interface State {
  error: Error | null
  errorInfo: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Keep the stack around for the fallback UI
    this.setState({ errorInfo: info.componentStack ?? null })
  }

  // Reset when the screen prop changes so navigating away clears the error
  componentDidUpdate(prevProps: Props) {
    if (prevProps.screen !== this.props.screen && this.state.error) {
      this.setState({ error: null, errorInfo: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={theme.danger} paddingX={2} paddingY={1}>
        <Text color={theme.danger} bold>✗ {this.props.screen} screen crashed</Text>
        <Text color={theme.text}>{this.state.error.message}</Text>
        {this.state.errorInfo && (
          <Box marginTop={1} flexDirection="column">
            <Text color={theme.muted} dimColor>
              {this.state.errorInfo.split('\n').slice(0, 6).join('\n')}
            </Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.muted}>
            Press <Text color={theme.highlight}>1..6</Text> to switch screens or{' '}
            <Text color={theme.highlight}>q</Text> to quit.
          </Text>
        </Box>
      </Box>
    )
  }
}
