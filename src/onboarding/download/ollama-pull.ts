/**
 * Provider adapter for Ollama's `POST /api/pull` streaming endpoint.
 *
 * Wire shape (NDJSON, one JSON object per line):
 *   { "status": "pulling manifest" }
 *   { "status": "pulling 8934d96d3f08", "digest": "sha256:...", "total": N, "completed": M }
 *   { "status": "verifying sha256 digest" }
 *   { "status": "writing manifest" }
 *   { "status": "removing any unused layers" }
 *   { "status": "success" }
 *
 * Error case (HTTP 200, error in stream):
 *   { "error": "pull model manifest: file does not exist" }
 *
 * We normalize these into a small `AdapterEvent` union. Engine layer
 * aggregates layer progress into a percent and computes ETA.
 */

import { readNdjson } from './ndjson.js'
import type { AdapterEvent } from './events.js'

export interface OllamaPullOptions {
  host: string // 'localhost:11434' (no scheme/path)
  model: string
  signal: AbortSignal
  /** Inject for tests. Defaults to the global `fetch`. */
  fetchFn?: typeof fetch
}

interface OllamaPullLine {
  status?: string
  digest?: string
  total?: number
  completed?: number
  error?: string
}

const RETRIABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

const NON_RETRIABLE_PATTERNS = [
  /file does not exist/i,
  /no space left on device/i,
  /not found/i,
  /unauthorized/i,
  /forbidden/i,
  /invalid/i,
]

function classifyError(message: string): { retriable: boolean } {
  for (const pat of NON_RETRIABLE_PATTERNS) {
    if (pat.test(message)) return { retriable: false }
  }
  return { retriable: true }
}

export async function* pullFromOllama(
  opts: OllamaPullOptions
): AsyncGenerator<AdapterEvent, void, void> {
  const fetchFn = opts.fetchFn ?? fetch
  const url = `http://${opts.host}/api/pull`
  let response: Response
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: opts.model, stream: true }),
      signal: opts.signal,
    })
  } catch (err) {
    const aborted = opts.signal.aborted
    const msg = err instanceof Error ? err.message : String(err)
    if (aborted) {
      yield { type: 'error', error: 'aborted', retriable: false }
      return
    }
    yield { type: 'error', error: msg, retriable: true }
    return
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const errorMsg = `HTTP ${response.status}${text ? ': ' + text.slice(0, 200) : ''}`
    const retriable =
      RETRIABLE_STATUS_CODES.has(response.status) && classifyError(errorMsg).retriable
    yield { type: 'error', error: errorMsg, retriable }
    return
  }

  if (!response.body) {
    yield { type: 'error', error: 'empty response body', retriable: true }
    return
  }

  // Track the last-seen status string so retries can resume cleanly.
  let lastPhase: 'manifest' | 'downloading' | 'verifying' | 'writing' | null = null

  for await (const raw of readNdjson<OllamaPullLine>(response.body, {
    signal: opts.signal,
  })) {
    if (opts.signal.aborted) {
      yield { type: 'error', error: 'aborted', retriable: false }
      return
    }

    if (raw.error) {
      const { retriable } = classifyError(raw.error)
      yield { type: 'error', error: raw.error, retriable }
      return
    }

    const status = raw.status ?? ''
    yield { type: 'log', line: status }

    if (/^pulling manifest$/i.test(status)) {
      if (lastPhase !== 'manifest') {
        lastPhase = 'manifest'
        yield { type: 'phase', phase: 'manifest' }
      }
      continue
    }

    // "pulling <12-hex-digest>"
    const layerMatch = status.match(/^pulling ([0-9a-f]{8,})$/i)
    if (layerMatch && typeof raw.total === 'number' && typeof raw.completed === 'number') {
      if (lastPhase !== 'downloading') {
        lastPhase = 'downloading'
        yield { type: 'phase', phase: 'downloading' }
      }
      yield {
        type: 'layer-progress',
        digest: layerMatch[1]!,
        total: raw.total,
        completed: raw.completed,
      }
      continue
    }

    if (/^verifying/i.test(status)) {
      if (lastPhase !== 'verifying') {
        lastPhase = 'verifying'
        yield { type: 'phase', phase: 'verifying' }
      }
      continue
    }

    if (/^writing manifest$/i.test(status) || /^removing/i.test(status)) {
      if (lastPhase !== 'writing') {
        lastPhase = 'writing'
        yield { type: 'phase', phase: 'writing' }
      }
      continue
    }

    if (/^success$/i.test(status)) {
      yield { type: 'done' }
      return
    }
    // Unknown status — already logged, nothing more to do.
  }

  // Stream ended without a `success` line. Treat as error.
  if (opts.signal.aborted) {
    yield { type: 'error', error: 'aborted', retriable: false }
  } else {
    yield { type: 'error', error: 'stream ended without success', retriable: true }
  }
}
