/**
 * Best-effort clipboard write. Uses the first available system tool:
 *   pbcopy        (macOS)
 *   xclip -sel c  (Linux + X11)
 *   wl-copy       (Linux + Wayland)
 *   clip.exe      (WSL / Windows-via-WSL)
 *
 * Returns a human-readable status string so the caller can toast it.
 */

import { spawn } from 'child_process'

const CANDIDATES: Array<{ cmd: string; args: string[] }> = [
  { cmd: 'pbcopy',   args: [] },
  { cmd: 'wl-copy',  args: [] },
  { cmd: 'xclip',    args: ['-selection', 'clipboard'] },
  { cmd: 'clip.exe', args: [] },
]

export async function writeClipboard(text: string): Promise<{ ok: boolean; tool: string }> {
  for (const { cmd, args } of CANDIDATES) {
    const ok = await tryCopy(cmd, args, text)
    if (ok) return { ok: true, tool: cmd }
  }
  return { ok: false, tool: 'none' }
}

function tryCopy(cmd: string, args: string[], text: string): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] })
      child.on('error', () => resolve(false))
      child.on('exit', code => resolve(code === 0))
      child.stdin.end(text)
    } catch {
      resolve(false)
    }
  })
}
