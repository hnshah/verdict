import { Box, Text, useInput } from 'ink'
import { theme } from '../../theme.js'

export interface WelcomeProps {
  onNext: () => void
  onCancel: () => void
}

export function Welcome({ onNext, onCancel }: WelcomeProps) {
  useInput((input, key) => {
    if (key.return) onNext()
    if (input === 's' || input === 'S') onCancel()
  })
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.text}>
        Welcome — let's get you to your first model comparison in under two minutes.
      </Text>
      <Box flexDirection="column">
        <Text color={theme.muted}>We'll:</Text>
        <Text color={theme.muted}>  • detect what's installed on your machine</Text>
        <Text color={theme.muted}>  • propose a setup (you can customize it)</Text>
        <Text color={theme.muted}>  • install Ollama if needed, with your consent</Text>
        <Text color={theme.muted}>  • pull a few small models in parallel</Text>
        <Text color={theme.muted}>  • run a quick smoke test to prove it all works</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.accent}>Enter</Text>
        <Text color={theme.muted}> to begin · </Text>
        <Text color={theme.accent}>s</Text>
        <Text color={theme.muted}> to skip · </Text>
        <Text color={theme.accent}>q</Text>
        <Text color={theme.muted}> to quit</Text>
      </Box>
    </Box>
  )
}
