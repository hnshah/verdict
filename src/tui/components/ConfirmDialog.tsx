/**
 * Modal confirm dialog. Focus-steals `useInput` while mounted.
 * 'y' or Enter confirms, anything else cancels.
 */

import { Box, Text, useInput } from 'ink'
import { theme } from '../theme.js'

export interface ConfirmDialogProps {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useInput((input, key) => {
    if (key.escape) { onCancel(); return }
    if (key.return || input === 'y' || input === 'Y') { onConfirm(); return }
    if (input === 'n' || input === 'N') { onCancel(); return }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.warning}
      paddingX={2}
      paddingY={1}
      width={60}
    >
      <Text color={theme.warning} bold>⚠ Confirm</Text>
      <Box marginTop={1}><Text>{message}</Text></Box>
      <Box marginTop={1}>
        <Text color={theme.highlight}>[Y]</Text>
        <Text color={theme.muted}> {confirmLabel}   </Text>
        <Text color={theme.highlight}>[N/Esc]</Text>
        <Text color={theme.muted}> {cancelLabel}</Text>
      </Box>
    </Box>
  )
}
