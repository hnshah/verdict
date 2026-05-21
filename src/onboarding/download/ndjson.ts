/**
 * UTF-8 safe line buffer for NDJSON streams.
 *
 * Two pitfalls this handles:
 *   1. JSON lines split across chunk boundaries — we buffer partial lines
 *      until a `\n` is seen.
 *   2. UTF-8 multi-byte sequences split across chunk boundaries — handled
 *      by `TextDecoder({ stream: true })`.
 *
 * Yields one parsed JSON value per line. Malformed lines are skipped (a
 * warning callback can be wired in via opts).
 *
 * Honors an AbortSignal: when aborted, calls `reader.cancel()` so the
 * underlying socket actually closes, then returns.
 */

export interface ReadNdjsonOptions {
  signal?: AbortSignal
  onWarn?: (msg: string) => void
}

export async function* readNdjson<T = unknown>(
  body: ReadableStream<Uint8Array>,
  opts: ReadNdjsonOptions = {}
): AsyncGenerator<T, void, void> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''

  // If we're already aborted, bail immediately.
  if (opts.signal?.aborted) {
    await reader.cancel().catch(() => undefined)
    return
  }

  // Wire abort listener so we can short-circuit a pending read.
  let aborted = false
  const onAbort = () => {
    aborted = true
    reader.cancel().catch(() => undefined)
  }
  opts.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    while (true) {
      if (aborted) return
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      // Drain complete lines.
      let nl = buf.indexOf('\n')
      while (nl >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '').trim()
        buf = buf.slice(nl + 1)
        if (line.length > 0) {
          const parsed = tryParse<T>(line)
          if (parsed.ok) yield parsed.value
          else opts.onWarn?.(`ndjson: skipping malformed line (${parsed.error})`)
        }
        nl = buf.indexOf('\n')
      }
    }

    // Flush any trailing partial line.
    const tail = buf.trim()
    if (tail.length > 0) {
      const parsed = tryParse<T>(tail)
      if (parsed.ok) yield parsed.value
      else opts.onWarn?.(`ndjson: skipping trailing fragment (${parsed.error})`)
    }
  } finally {
    opts.signal?.removeEventListener('abort', onAbort)
  }
}

function tryParse<T>(s: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(s) as T }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Test helper: build a ReadableStream from chunked bytes ─────────────────

/**
 * Helper for tests: turn an array of strings into a `ReadableStream<Uint8Array>`.
 * Each string is a separate chunk so callers can simulate boundary edge cases.
 */
export function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]!))
        i++
      } else {
        controller.close()
      }
    },
  })
}
