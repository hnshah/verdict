import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer, type Server } from 'http'
import { postWebhook } from '../webhook.js'

interface CapturedRequest {
  method: string
  url: string
  body: string
  headers: Record<string, string | string[] | undefined>
}

function startServer(respond: (req: CapturedRequest, count: number) => { status: number; body?: string }): Promise<{ server: Server; url: string; captured: CapturedRequest[] }> {
  return new Promise((resolve) => {
    const captured: CapturedRequest[] = []
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', chunk => body += String(chunk))
      req.on('end', () => {
        const cap: CapturedRequest = {
          method: req.method ?? '',
          url: req.url ?? '',
          body,
          headers: req.headers as Record<string, string | string[] | undefined>,
        }
        captured.push(cap)
        const r = respond(cap, captured.length)
        res.statusCode = r.status
        res.end(r.body ?? '')
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        resolve({ server, url: `http://127.0.0.1:${addr.port}/hook`, captured })
      }
    })
  })
}

describe('postWebhook', () => {
  let cleanup: Server | null = null
  afterEach(() => {
    if (cleanup) cleanup.close()
    cleanup = null
  })

  it('POSTs JSON body with correct content-type and reports ok on 2xx', async () => {
    const { server, url, captured } = await startServer(() => ({ status: 200 }))
    cleanup = server

    const result = await postWebhook(url, { text: 'hi', n: 42 })
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)

    expect(captured).toHaveLength(1)
    expect(captured[0].method).toBe('POST')
    expect(captured[0].headers['content-type']).toBe('application/json')
    expect(JSON.parse(captured[0].body)).toEqual({ text: 'hi', n: 42 })
  })

  it('does NOT retry on 4xx', async () => {
    const { server, url, captured } = await startServer(() => ({ status: 404 }))
    cleanup = server

    const result = await postWebhook(url, {}, { retries: 3 })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
    expect(captured).toHaveLength(1)
  })

  it('retries on 5xx and succeeds when the next attempt works', async () => {
    const { server, url, captured } = await startServer((_req, count) => {
      if (count === 1) return { status: 503 }
      return { status: 200 }
    })
    cleanup = server

    const result = await postWebhook(url, {}, { retries: 2 })
    expect(result.ok).toBe(true)
    expect(captured).toHaveLength(2)
  })

  it('returns ok:false when url is empty', async () => {
    const result = await postWebhook('', {})
    expect(result.ok).toBe(false)
    expect(result.error).toBe('empty url')
  })
})
