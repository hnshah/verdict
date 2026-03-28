/**
 * Simple IPC client for communicating with a running verdict daemon
 * via a Unix domain socket at ~/.verdict/daemon.sock.
 */

import net from 'net'
import path from 'path'
import os from 'os'

const SOCK_PATH = path.join(os.homedir(), '.verdict', 'daemon.sock')

export { SOCK_PATH }

export interface IpcRequest {
  action: 'status' | 'stop' | 'queue'
  payload?: Record<string, unknown>
}

export interface IpcResponse {
  ok: boolean
  data?: unknown
  error?: string
}

/** Send a request to the daemon via Unix socket and get a response. */
export function sendIpc(request: IpcRequest, timeoutMs = 5000): Promise<IpcResponse> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(SOCK_PATH, () => {
      client.write(JSON.stringify(request))
    })

    let data = ''
    client.on('data', chunk => { data += chunk.toString() })
    client.on('end', () => {
      try {
        resolve(JSON.parse(data) as IpcResponse)
      } catch {
        resolve({ ok: false, error: 'Invalid response from daemon' })
      }
    })
    client.on('error', err => {
      reject(new Error(`Cannot connect to daemon: ${err.message}`))
    })

    const timer = setTimeout(() => {
      client.destroy()
      reject(new Error('IPC request timed out'))
    }, timeoutMs)

    client.on('close', () => clearTimeout(timer))
  })
}

/** Start an IPC server that handles requests for the daemon. */
export function startIpcServer(
  handler: (req: IpcRequest) => IpcResponse | Promise<IpcResponse>,
): net.Server {
  // Remove stale socket file
  const fs = require('fs') as typeof import('fs')
  try { fs.unlinkSync(SOCK_PATH) } catch { /* doesn't exist */ }

  const server = net.createServer(socket => {
    let data = ''
    socket.on('data', chunk => { data += chunk.toString() })
    socket.on('end', async () => {
      try {
        const req = JSON.parse(data) as IpcRequest
        const res = await handler(req)
        socket.end(JSON.stringify(res))
      } catch {
        socket.end(JSON.stringify({ ok: false, error: 'Invalid request' }))
      }
    })
  })

  server.listen(SOCK_PATH)
  return server
}
