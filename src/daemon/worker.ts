/**
 * Daemon worker entry point — spawned as a detached child process by `verdict daemon start`.
 * Starts the VerdictDaemon + IPC server and logs to ~/.verdict/daemon.log.
 */

import { VerdictDaemon } from './index.js'
import { startIpcServer } from './ipc.js'
import { addJob } from '../db/client.js'
import type { IpcRequest, IpcResponse } from './ipc.js'

const daemon = new VerdictDaemon()

const ipcServer = startIpcServer(async (req: IpcRequest): Promise<IpcResponse> => {
  switch (req.action) {
    case 'status':
      return { ok: true, data: daemon.getStatus() }

    case 'stop':
      daemon.stop()
      ipcServer.close()
      // Give time for response to flush before exiting
      setTimeout(() => process.exit(0), 200)
      return { ok: true, data: { message: 'Daemon stopping' } }

    case 'queue': {
      if (!req.payload) return { ok: false, error: 'Missing payload for queue action' }
      const { getDb, initSchema } = await import('../db/client.js')
      const db = getDb()
      initSchema(db)
      const id = addJob(db, {
        type: req.payload['type'] as string,
        model_id: req.payload['model_id'] as string | undefined,
        input: req.payload['input'] ? JSON.stringify(req.payload['input']) : undefined,
        priority: req.payload['priority'] as number | undefined,
      })
      db.close()
      return { ok: true, data: { jobId: id } }
    }

    default:
      return { ok: false, error: `Unknown action: ${req.action}` }
  }
})

daemon.start()

// Handle signals for graceful shutdown
process.on('SIGTERM', () => {
  daemon.stop()
  ipcServer.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  daemon.stop()
  ipcServer.close()
  process.exit(0)
})
