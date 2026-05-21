import { describe, expect, it } from 'vitest'
import { pullFromOllama } from '../download/ollama-pull.js'
import { streamFromChunks } from '../download/ndjson.js'
import type { AdapterEvent } from '../download/events.js'

function mockFetch(body: ReadableStream<Uint8Array> | string, status = 200): typeof fetch {
  const resp = new Response(typeof body === 'string' ? body : body, {
    status,
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
  return async () => resp
}

const linesToStream = (lines: string[]): ReadableStream<Uint8Array> =>
  streamFromChunks(lines.map(l => (l.endsWith('\n') ? l : l + '\n')))

describe('pullFromOllama', () => {
  it('emits phase + layer-progress + done for a happy path pull', async () => {
    const body = linesToStream([
      JSON.stringify({ status: 'pulling manifest' }),
      JSON.stringify({ status: 'pulling 8934d96d3f08', digest: 'sha256:abc', total: 1000, completed: 0 }),
      JSON.stringify({ status: 'pulling 8934d96d3f08', digest: 'sha256:abc', total: 1000, completed: 500 }),
      JSON.stringify({ status: 'pulling 8934d96d3f08', digest: 'sha256:abc', total: 1000, completed: 1000 }),
      JSON.stringify({ status: 'verifying sha256 digest' }),
      JSON.stringify({ status: 'writing manifest' }),
      JSON.stringify({ status: 'removing any unused layers' }),
      JSON.stringify({ status: 'success' }),
    ])
    const events: AdapterEvent[] = []
    for await (const e of pullFromOllama({
      host: 'localhost:11434',
      model: 'qwen2.5:0.5b',
      signal: new AbortController().signal,
      fetchFn: mockFetch(body),
    })) {
      events.push(e)
    }
    const phases = events.filter(e => e.type === 'phase').map(e => (e as { type: 'phase'; phase: string }).phase)
    expect(phases).toContain('manifest')
    expect(phases).toContain('downloading')
    expect(phases).toContain('verifying')
    expect(phases).toContain('writing')
    const layerEvents = events.filter(e => e.type === 'layer-progress')
    expect(layerEvents.length).toBe(3)
    const last = events[events.length - 1]
    expect(last?.type).toBe('done')
  })

  it('handles multiple layers (different digests)', async () => {
    const body = linesToStream([
      JSON.stringify({ status: 'pulling manifest' }),
      JSON.stringify({ status: 'pulling aaaa1111', digest: 'sha256:aaaa', total: 1000, completed: 1000 }),
      JSON.stringify({ status: 'pulling bbbb2222', digest: 'sha256:bbbb', total: 2000, completed: 1000 }),
      JSON.stringify({ status: 'pulling bbbb2222', digest: 'sha256:bbbb', total: 2000, completed: 2000 }),
      JSON.stringify({ status: 'success' }),
    ])
    const events: AdapterEvent[] = []
    for await (const e of pullFromOllama({
      host: 'localhost:11434',
      model: 'model',
      signal: new AbortController().signal,
      fetchFn: mockFetch(body),
    })) {
      events.push(e)
    }
    const layerEvents = events.filter(e => e.type === 'layer-progress')
    const digests = new Set(layerEvents.map(e => (e as { type: 'layer-progress'; digest: string }).digest))
    expect(digests.size).toBe(2)
  })

  it('classifies in-stream error as non-retriable when the message matches a known pattern', async () => {
    const body = linesToStream([
      JSON.stringify({ status: 'pulling manifest' }),
      JSON.stringify({ error: 'pull model manifest: file does not exist' }),
    ])
    const events: AdapterEvent[] = []
    for await (const e of pullFromOllama({
      host: 'localhost:11434',
      model: 'badmodel',
      signal: new AbortController().signal,
      fetchFn: mockFetch(body),
    })) {
      events.push(e)
    }
    const errEvent = events.find(e => e.type === 'error') as Extract<AdapterEvent, { type: 'error' }>
    expect(errEvent).toBeDefined()
    expect(errEvent.retriable).toBe(false)
    expect(errEvent.error).toMatch(/does not exist/i)
  })

  it('classifies HTTP 5xx as retriable', async () => {
    const events: AdapterEvent[] = []
    for await (const e of pullFromOllama({
      host: 'localhost:11434',
      model: 'm',
      signal: new AbortController().signal,
      fetchFn: mockFetch('Internal Server Error', 503),
    })) {
      events.push(e)
    }
    const errEvent = events.find(e => e.type === 'error') as Extract<AdapterEvent, { type: 'error' }>
    expect(errEvent).toBeDefined()
    expect(errEvent.retriable).toBe(true)
  })

  it('classifies disk-full message as non-retriable', async () => {
    const body = linesToStream([
      JSON.stringify({ status: 'pulling 1234abcd', digest: 'sha256:x', total: 100, completed: 50 }),
      JSON.stringify({ error: 'write: no space left on device' }),
    ])
    const events: AdapterEvent[] = []
    for await (const e of pullFromOllama({
      host: 'localhost:11434',
      model: 'm',
      signal: new AbortController().signal,
      fetchFn: mockFetch(body),
    })) {
      events.push(e)
    }
    const errEvent = events.find(e => e.type === 'error') as Extract<AdapterEvent, { type: 'error' }>
    expect(errEvent.retriable).toBe(false)
  })

  it('treats fetch network errors as retriable (and aborts as non-retriable)', async () => {
    const events: AdapterEvent[] = []
    const fetchThatThrows = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    for await (const e of pullFromOllama({
      host: 'localhost:11434',
      model: 'm',
      signal: new AbortController().signal,
      fetchFn: fetchThatThrows,
    })) {
      events.push(e)
    }
    const errEvent = events.find(e => e.type === 'error') as Extract<AdapterEvent, { type: 'error' }>
    expect(errEvent.retriable).toBe(true)
  })

  it('respects an already-aborted signal during fetch', async () => {
    const ac = new AbortController()
    ac.abort()
    const events: AdapterEvent[] = []
    const fetchThatThrows = (async () => {
      const e = new Error('aborted')
      ;(e as { name?: string }).name = 'AbortError'
      throw e
    }) as unknown as typeof fetch
    for await (const e of pullFromOllama({
      host: 'localhost:11434',
      model: 'm',
      signal: ac.signal,
      fetchFn: fetchThatThrows,
    })) {
      events.push(e)
    }
    const errEvent = events.find(e => e.type === 'error') as Extract<AdapterEvent, { type: 'error' }>
    expect(errEvent.retriable).toBe(false)
    expect(errEvent.error).toBe('aborted')
  })

  it('stream ending without success is a retriable error', async () => {
    const body = linesToStream([
      JSON.stringify({ status: 'pulling manifest' }),
    ])
    const events: AdapterEvent[] = []
    for await (const e of pullFromOllama({
      host: 'localhost:11434',
      model: 'm',
      signal: new AbortController().signal,
      fetchFn: mockFetch(body),
    })) {
      events.push(e)
    }
    const errEvent = events.find(e => e.type === 'error') as Extract<AdapterEvent, { type: 'error' }>
    expect(errEvent.retriable).toBe(true)
    expect(errEvent.error).toMatch(/ended without success/)
  })
})
