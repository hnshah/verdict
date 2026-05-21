import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelConfig } from '../../types/index.js'

// Mock both compat entry points so preload's streaming-first / fallback
// flow can be exercised deterministically.
vi.mock('../../providers/compat.js', () => ({
  callModel: vi.fn(),
  streamFirstToken: vi.fn(),
}))

let preloadMod: typeof import('../preload.js')
let compat: typeof import('../../providers/compat.js')

beforeEach(async () => {
  vi.resetModules()
  preloadMod = await import('../preload.js')
  compat = await import('../../providers/compat.js')
  // Default streamFirstToken to a quick success so individual tests can
  // override per scenario.
  vi.mocked(compat.streamFirstToken).mockResolvedValue({
    ok: true,
    firstTokenMs: 10,
    totalMs: 15,
  })
  // Silence preload's chalk-prefixed console.log during tests so output
  // doesn't drown the test runner.
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

const ollama = (id: string): ModelConfig => ({
  id,
  provider: 'ollama',
  model: id,
  api_key: 'none',
  port: 8080,
  tags: [],
  timeout_ms: 60_000,
  max_tokens: 1024,
})

describe('preloadModels', () => {
  it('runs loads in parallel up to the concurrency cap', async () => {
    // Track in-flight count over time. With concurrency=2 and three slow
    // models, the peak should be exactly 2.
    let inFlight = 0
    let peak = 0
    vi.mocked(compat.streamFirstToken).mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise(r => setTimeout(r, 50))
      inFlight -= 1
      return { ok: true, firstTokenMs: 20, totalMs: 50 }
    })

    const results = await preloadMod.preloadModels(
      [ollama('a'), ollama('b'), ollama('c')],
      { concurrency: 2 }
    )
    expect(results).toHaveLength(3)
    expect(results.every(r => r.success)).toBe(true)
    expect(peak).toBe(2)
  })

  it('skips non-Ollama models (cloud / mlx have no warmup)', async () => {
    vi.mocked(compat.streamFirstToken).mockResolvedValue({ ok: true, firstTokenMs: 5, totalMs: 10 })
    const results = await preloadMod.preloadModels(
      [
        ollama('local'),
        // A cloud model (no provider) — needsPreload returns false.
        { id: 'cloud', provider: 'mlx', model: 'm', api_key: 'none', port: 8080, tags: [], timeout_ms: 60_000, max_tokens: 1024 } as ModelConfig,
      ],
      { concurrency: 2 }
    )
    expect(results).toHaveLength(1)
    expect(results[0]?.model).toBe('local')
  })

  it('returns failure when stream + fallback both fail (e.g. transient)', async () => {
    vi.mocked(compat.streamFirstToken).mockImplementation(async (m: ModelConfig) => {
      if (m.id === 'flaky') return { ok: false, firstTokenMs: -1, totalMs: 10, error: 'TimeoutError: read timeout' }
      return { ok: true, firstTokenMs: 5, totalMs: 10 }
    })
    vi.mocked(compat.callModel).mockImplementation(async (m: ModelConfig) => {
      if (m.id === 'flaky') throw new Error('still flaky')
      return { text: 'ok' } as any
    })
    const results = await preloadMod.preloadModels(
      [ollama('flaky'), ollama('ok')],
      { concurrency: 2 }
    )
    expect(results.find(r => r.model === 'flaky')?.success).toBe(false)
    expect(results.find(r => r.model === 'ok')?.success).toBe(true)
  })

  it('detects OOM-like errors and switches to sequential mode', async () => {
    let secondInFlight = 0
    let secondPeak = 0
    let callCount = 0
    vi.mocked(compat.streamFirstToken).mockImplementation(async (m: ModelConfig) => {
      callCount += 1
      if (m.id === 'first') {
        await new Promise(r => setTimeout(r, 20))
        return { ok: false, firstTokenMs: -1, totalMs: 20, error: 'unable to allocate memory: out of memory' }
      }
      secondInFlight += 1
      secondPeak = Math.max(secondPeak, secondInFlight)
      await new Promise(r => setTimeout(r, 30))
      secondInFlight -= 1
      return { ok: true, firstTokenMs: 15, totalMs: 30 }
    })
    // Fallback also fails for the OOM case so it's recorded as a failure.
    vi.mocked(compat.callModel).mockImplementation(async (m: ModelConfig) => {
      if (m.id === 'first') throw new Error('out of memory')
      return { text: 'ok' } as any
    })

    const results = await preloadMod.preloadModels(
      [ollama('first'), ollama('second'), ollama('third')],
      { concurrency: 2 }
    )
    expect(callCount).toBeGreaterThanOrEqual(3)
    const first = results.find(r => r.model === 'first')
    expect(first?.success).toBe(false)
    expect(first?.error).toMatch(/memory/i)
    // After OOM detection, second + third should not run in parallel.
    expect(secondPeak).toBeLessThanOrEqual(1)
  })

  it('emits onProgress events in start/done order for each model', async () => {
    vi.mocked(compat.streamFirstToken).mockResolvedValue({ ok: true, firstTokenMs: 5, totalMs: 10 })
    const events: import('../preload.js').PreloadProgressEvent[] = []
    await preloadMod.preloadModels(
      [ollama('a'), ollama('b')],
      {
        concurrency: 1,
        onProgress: ev => events.push(ev),
      }
    )
    // With concurrency=1, events should be strictly start-a, done-a, start-b, done-b.
    expect(events.map(e => e.type)).toEqual(['start', 'done', 'start', 'done'])
    expect(events[0]).toMatchObject({ type: 'start', model: 'a' })
    expect(events[2]).toMatchObject({ type: 'start', model: 'b' })
  })

  it('streamFirstToken success reports firstTokenMs distinct from total duration', async () => {
    vi.mocked(compat.streamFirstToken).mockResolvedValue({ ok: true, firstTokenMs: 1200, totalMs: 1500 })
    const results = await preloadMod.preloadModels([ollama('m')], { concurrency: 1 })
    expect(results[0]?.firstTokenMs).toBe(1200)
    expect(results[0]?.duration).toBe(1500)
  })
})

describe('preloadModelsAsync', () => {
  it('returns futures synchronously and resolves them as loads complete', async () => {
    // Fast model finishes quickly, slow model takes longer. The futures
    // map should be available immediately, and `fast` should resolve
    // before `slow` (this is the headline behavior for B3: cases on the
    // fast model can start before the slow model finishes warming).
    const fastDone = vi.fn()
    const slowDone = vi.fn()
    vi.mocked(compat.streamFirstToken).mockImplementation(async (m) => {
      if (m.id === 'fast') {
        await new Promise(r => setTimeout(r, 10))
        return { ok: true, firstTokenMs: 5, totalMs: 10 }
      }
      await new Promise(r => setTimeout(r, 100))
      return { ok: true, firstTokenMs: 50, totalMs: 100 }
    })

    const futures = preloadMod.preloadModelsAsync(
      [ollama('fast'), ollama('slow')],
      { concurrency: 2 }
    )
    expect(futures.size).toBe(2)

    futures.get('fast')!.then(fastDone)
    futures.get('slow')!.then(slowDone)

    // Wait for fast first.
    const fastResult = await futures.get('fast')!
    expect(fastResult.success).toBe(true)
    expect(fastDone).toHaveBeenCalled()
    // slow shouldn't be done yet — assert by checking the mock hasn't fired.
    expect(slowDone).not.toHaveBeenCalled()

    const slowResult = await futures.get('slow')!
    expect(slowResult.success).toBe(true)
  })

  it('non-Ollama models resolve immediately to success', async () => {
    vi.mocked(compat.streamFirstToken).mockResolvedValue({ ok: true, firstTokenMs: 5, totalMs: 10 })
    const futures = preloadMod.preloadModelsAsync(
      [
        ollama('local'),
        { id: 'cloud', provider: 'mlx', model: 'm', api_key: 'none', port: 8080, tags: [], timeout_ms: 60_000, max_tokens: 1024 } as ModelConfig,
      ],
      { concurrency: 1 }
    )
    expect(futures.size).toBe(2)
    // cloud should resolve immediately (no actual preload work).
    const cloudResult = await futures.get('cloud')!
    expect(cloudResult.success).toBe(true)
    expect(cloudResult.duration).toBe(0)
  })

  it('honors the concurrency cap across model loads', async () => {
    let inFlight = 0
    let peak = 0
    vi.mocked(compat.streamFirstToken).mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise(r => setTimeout(r, 30))
      inFlight -= 1
      return { ok: true, firstTokenMs: 10, totalMs: 30 }
    })

    const futures = preloadMod.preloadModelsAsync(
      [ollama('a'), ollama('b'), ollama('c'), ollama('d')],
      { concurrency: 2 }
    )
    await Promise.all([...futures.values()])
    expect(peak).toBe(2)
  })
})
