/**
 * Serve screen — start/stop the `verdict serve` OpenAI-compatible proxy
 * as a managed child process, tail its stdout.
 *
 * Spawns the local verdict CLI so it uses whatever config + models are
 * configured in the current directory. Uses `npx tsx` when running from
 * source and `node dist/cli/index.js` when running from the built artifact.
 */

import { useEffect, useRef, useState } from 'react'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { Box, Text, useInput } from 'ink'
import { theme } from '../theme.js'
import { LogStream } from '../components/LogStream.js'

export interface ServeProps {
  onBack?: () => void
}

type Status = 'stopped' | 'starting' | 'running' | 'error'

function findCliEntry(): { cmd: string; args: string[] } {
  // Climb from this file to project root; prefer dist/cli/index.js, fall back to tsx
  const here = fileURLToPath(import.meta.url)
  let dir = path.dirname(here)
  for (let i = 0; i < 6 && dir !== '/'; i++) {
    const built = path.join(dir, 'dist', 'cli', 'index.js')
    const src = path.join(dir, 'src', 'cli', 'index.ts')
    if (fs.existsSync(built)) return { cmd: 'node', args: [built] }
    if (fs.existsSync(src)) return { cmd: 'npx', args: ['tsx', src] }
    dir = path.dirname(dir)
  }
  return { cmd: 'verdict', args: [] }
}

export function Serve(_props: ServeProps) {
  const [status, setStatus] = useState<Status>('stopped')
  const [port, setPort] = useState(4000)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const childRef = useRef<ChildProcess | null>(null)

  const pushLog = (line: string) => {
    setLog(l => [...l, line].slice(-200))
  }

  const stop = () => {
    if (!childRef.current) return
    try { childRef.current.kill('SIGTERM') } catch {}
    childRef.current = null
    setStatus('stopped')
  }

  const start = () => {
    if (childRef.current) return
    const { cmd, args } = findCliEntry()
    setStatus('starting')
    setError(null)
    setLog([])
    try {
      const child = spawn(cmd, [...args, 'serve', '--port', String(port)], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      childRef.current = child
      child.stdout?.on('data', (buf) => {
        for (const line of String(buf).split('\n').filter(Boolean)) pushLog(line)
        setStatus('running')
      })
      child.stderr?.on('data', (buf) => {
        for (const line of String(buf).split('\n').filter(Boolean)) pushLog(`[err] ${line}`)
      })
      child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          setError(`Exited with code ${code}`)
          setStatus('error')
        } else {
          setStatus('stopped')
        }
        childRef.current = null
      })
      child.on('error', (e) => {
        setError(e.message)
        setStatus('error')
        childRef.current = null
      })
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  useEffect(() => () => { stop() }, [])  // kill on unmount

  useInput((input) => {
    if (input === 's') {
      if (status === 'running' || status === 'starting') stop()
      else start()
    }
    if (input === '+' || input === '=') setPort(p => p + 1)
    if (input === '-' || input === '_') setPort(p => Math.max(1024, p - 1))
  })

  const statusColor: string =
    status === 'running'  ? theme.success :
    status === 'starting' ? theme.warning :
    status === 'error'    ? theme.danger  :
    theme.muted

  const statusDot =
    status === 'running'  ? '●' :
    status === 'starting' ? '◐' :
    status === 'error'    ? '✗' : '○'

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>🌐 Serve  </Text>
        <Text color={theme.muted}>
          s: start/stop · +/- port · Ctrl-C to quit TUI (kills proxy)
        </Text>
      </Box>

      <Box>
        <Text color={statusColor} bold>{statusDot} {status}</Text>
        <Text color={theme.muted}>  port </Text>
        <Text color={theme.text}>{port}</Text>
        {status === 'running' && (
          <Text color={theme.muted}>   POST http://localhost:{port}/v1/chat/completions</Text>
        )}
      </Box>

      {error && <Text color={theme.danger}>  {error}</Text>}

      {status === 'running' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.muted}>
            Try:{' '}
            <Text color={theme.text}>
              curl -X POST http://localhost:{port}/v1/chat/completions -d '{'{'}"model":"auto","messages":[...]{'}'}'
            </Text>
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <LogStream lines={log} height={14} title="proxy log" />
      </Box>
    </Box>
  )
}
