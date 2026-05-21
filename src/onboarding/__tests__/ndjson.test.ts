import { describe, expect, it } from 'vitest'
import { readNdjson, streamFromChunks } from '../download/ndjson.js'

describe('readNdjson', () => {
  it('parses a single complete line', async () => {
    const stream = streamFromChunks(['{"a":1}\n'])
    const out: unknown[] = []
    for await (const v of readNdjson(stream)) out.push(v)
    expect(out).toEqual([{ a: 1 }])
  })

  it('reassembles a JSON line split across chunks', async () => {
    const stream = streamFromChunks(['{"a":', '1,"b":', '"hello"}\n'])
    const out: unknown[] = []
    for await (const v of readNdjson(stream)) out.push(v)
    expect(out).toEqual([{ a: 1, b: 'hello' }])
  })

  it('parses multiple JSON lines in one chunk', async () => {
    const stream = streamFromChunks(['{"a":1}\n{"b":2}\n{"c":3}\n'])
    const out: unknown[] = []
    for await (const v of readNdjson(stream)) out.push(v)
    expect(out).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })

  it('handles UTF-8 multi-byte split across chunks', async () => {
    // The string "café" is 'c','a','f',0xC3,0xA9 in UTF-8.
    const encoder = new TextEncoder()
    const full = encoder.encode('{"name":"café"}\n')
    // Split right between the 0xC3 and 0xA9 of 'é'.
    const breakpoint = full.indexOf(0xc3) + 1
    const a = full.slice(0, breakpoint)
    const b = full.slice(breakpoint)
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(a)
        c.enqueue(b)
        c.close()
      },
    })
    const out: { name: string }[] = []
    for await (const v of readNdjson<{ name: string }>(stream)) out.push(v)
    expect(out).toEqual([{ name: 'café' }])
  })

  it('skips empty lines', async () => {
    const stream = streamFromChunks(['{"a":1}\n\n\n{"b":2}\n'])
    const out: unknown[] = []
    for await (const v of readNdjson(stream)) out.push(v)
    expect(out).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('tolerates \\r\\n line endings (HTTP-like)', async () => {
    const stream = streamFromChunks(['{"a":1}\r\n{"b":2}\r\n'])
    const out: unknown[] = []
    for await (const v of readNdjson(stream)) out.push(v)
    expect(out).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('parses a trailing fragment without newline', async () => {
    const stream = streamFromChunks(['{"a":1}\n{"b":2}'])
    const out: unknown[] = []
    for await (const v of readNdjson(stream)) out.push(v)
    expect(out).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('skips a malformed line and emits a warning', async () => {
    const warnings: string[] = []
    const stream = streamFromChunks(['{"ok":1}\nNOT JSON\n{"ok":2}\n'])
    const out: unknown[] = []
    for await (const v of readNdjson(stream, { onWarn: m => warnings.push(m) })) out.push(v)
    expect(out).toEqual([{ ok: 1 }, { ok: 2 }])
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('aborts mid-stream when signal fires', async () => {
    const ac = new AbortController()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('{"a":1}\n'))
        // Don't close — wait for cancel.
      },
    })
    const out: unknown[] = []
    const it = readNdjson(stream, { signal: ac.signal })
    const first = await it.next()
    expect(first.value).toEqual({ a: 1 })
    ac.abort()
    const second = await it.next()
    expect(second.done).toBe(true)
  })

  it('returns immediately when already aborted', async () => {
    const ac = new AbortController()
    ac.abort()
    const stream = streamFromChunks(['{"a":1}\n'])
    const out: unknown[] = []
    for await (const v of readNdjson(stream, { signal: ac.signal })) out.push(v)
    expect(out).toEqual([])
  })
})
