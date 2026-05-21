import { describe, expect, it, vi } from 'vitest'
import { createDownloadEngine } from '../download/engine.js'
import type { AdapterEvent, DownloadEvent } from '../download/events.js'

type AdapterArgs = { host: string; model: string; signal: AbortSignal }

/**
 * Build an adapter that emits a scripted sequence of events. Useful for
 * deterministic tests without a real Ollama.
 */
function scriptedAdapter(
  scripts: Record<string, AdapterEvent[]>
): (args: AdapterArgs) => AsyncIterable<AdapterEvent> {
  return args => ({
    async *[Symbol.asyncIterator]() {
      const events = scripts[args.model] ?? [{ type: 'error', error: 'no script', retriable: false }]
      for (const ev of events) {
        if (args.signal.aborted) {
          yield { type: 'error', error: 'aborted', retriable: false }
          return
        }
        // Yield a microtask between events so concurrency tests can interleave.
        await Promise.resolve()
        yield ev
      }
    },
  })
}

const happyPath: AdapterEvent[] = [
  { type: 'phase', phase: 'manifest' },
  { type: 'phase', phase: 'downloading' },
  { type: 'layer-progress', digest: 'abc', total: 1000, completed: 500 },
  { type: 'layer-progress', digest: 'abc', total: 1000, completed: 1000 },
  { type: 'phase', phase: 'verifying' },
  { type: 'phase', phase: 'writing' },
  { type: 'done' },
]

describe('createDownloadEngine', () => {
  it('runs a single model end-to-end (happy path)', async () => {
    const adapter = scriptedAdapter({ 'foo:1b': happyPath })
    const engine = createDownloadEngine({ adapter, progressIntervalMs: 0 })
    const events: DownloadEvent[] = []
    engine.onAny(e => events.push(e))
    const summary = await engine.start([{ modelName: 'foo:1b', provider: 'ollama' }])
    expect(summary.succeeded).toEqual(['foo:1b'])
    expect(summary.failed).toEqual([])
    const done = events.find(e => e.type === 'task-done')
    expect(done).toBeDefined()
    const finalSnap = engine.snapshot()
    expect(finalSnap.tasks['foo:1b']?.phase).toBe('done')
    expect(finalSnap.tasks['foo:1b']?.percent).toBe(100)
    expect(finalSnap.aggregate.doneTasks).toBe(1)
  })

  it('processes multiple models with bounded concurrency', async () => {
    let concurrentNow = 0
    let observedMax = 0

    function slowAdapter() {
      return (args: AdapterArgs): AsyncIterable<AdapterEvent> => ({
        async *[Symbol.asyncIterator]() {
          concurrentNow += 1
          observedMax = Math.max(observedMax, concurrentNow)
          try {
            yield { type: 'phase', phase: 'downloading' }
            // Simulate work.
            await new Promise(r => setTimeout(r, 30))
            yield { type: 'layer-progress', digest: args.model, total: 100, completed: 100 }
            yield { type: 'done' }
          } finally {
            concurrentNow -= 1
          }
        },
      })
    }

    const engine = createDownloadEngine({
      adapter: slowAdapter(),
      concurrency: 2,
      progressIntervalMs: 0,
    })
    const summary = await engine.start([
      { modelName: 'a', provider: 'ollama' },
      { modelName: 'b', provider: 'ollama' },
      { modelName: 'c', provider: 'ollama' },
      { modelName: 'd', provider: 'ollama' },
    ])
    expect(summary.succeeded).toHaveLength(4)
    expect(observedMax).toBeLessThanOrEqual(2)
  })

  it('retries on retriable error and then succeeds', async () => {
    let calls = 0
    const adapter = (args: AdapterArgs): AsyncIterable<AdapterEvent> => ({
      async *[Symbol.asyncIterator]() {
        calls += 1
        if (calls === 1) {
          yield { type: 'error', error: 'network blip', retriable: true }
          return
        }
        for (const ev of happyPath) yield ev
      },
    })
    const engine = createDownloadEngine({
      adapter,
      retryBaseMs: 1,
      progressIntervalMs: 0,
    })
    const phases: string[] = []
    engine.on('task-phase', e => phases.push(`${e.from}->${e.to}`))
    const summary = await engine.start([{ modelName: 'm', provider: 'ollama' }])
    expect(summary.succeeded).toEqual(['m'])
    // Should have seen a `retrying` phase.
    expect(phases.some(p => p.endsWith('retrying'))).toBe(true)
    expect(calls).toBe(2)
  })

  it('does NOT retry on non-retriable errors', async () => {
    let calls = 0
    const adapter = (_args: AdapterArgs): AsyncIterable<AdapterEvent> => ({
      async *[Symbol.asyncIterator]() {
        calls += 1
        yield { type: 'error', error: 'file does not exist', retriable: false }
      },
    })
    const engine = createDownloadEngine({
      adapter,
      retryBaseMs: 1,
      progressIntervalMs: 0,
    })
    const summary = await engine.start([{ modelName: 'badname', provider: 'ollama' }])
    expect(summary.failed).toHaveLength(1)
    expect(summary.failed[0]?.error).toMatch(/does not exist/i)
    expect(calls).toBe(1)
  })

  it('cancellation aborts in-flight + skips queued', async () => {
    let aborted = 0
    const adapter = (args: AdapterArgs): AsyncIterable<AdapterEvent> => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'phase', phase: 'downloading' }
        await new Promise(r => setTimeout(r, 200))
        if (args.signal.aborted) {
          aborted += 1
          yield { type: 'error', error: 'aborted', retriable: false }
          return
        }
        yield { type: 'done' }
      },
    })
    const engine = createDownloadEngine({
      adapter,
      concurrency: 1,
      progressIntervalMs: 0,
      retryBaseMs: 1,
    })
    const startP = engine.start([
      { modelName: 'a', provider: 'ollama' },
      { modelName: 'b', provider: 'ollama' },
    ])
    setTimeout(() => engine.cancel(), 30)
    const summary = await startP
    expect(summary.succeeded).toEqual([])
    // At least one task either canceled or failed-as-aborted; the queued one
    // should never have started.
    expect(summary.canceled.length + summary.failed.length).toBeGreaterThanOrEqual(1)
    expect(aborted).toBeGreaterThanOrEqual(1)
  })

  it('aggregates overallPercent from per-task percents', async () => {
    const adapter = scriptedAdapter({
      a: [
        { type: 'phase', phase: 'downloading' },
        { type: 'layer-progress', digest: 'x', total: 100, completed: 100 },
        { type: 'done' },
      ],
      b: [
        { type: 'phase', phase: 'downloading' },
        { type: 'layer-progress', digest: 'y', total: 100, completed: 100 },
        { type: 'done' },
      ],
    })
    const engine = createDownloadEngine({ adapter, progressIntervalMs: 0 })
    await engine.start([
      { modelName: 'a', provider: 'ollama' },
      { modelName: 'b', provider: 'ollama' },
    ])
    const snap = engine.snapshot()
    expect(snap.aggregate.overallPercent).toBeCloseTo(100, 1)
    expect(snap.aggregate.totalTasks).toBe(2)
    expect(snap.aggregate.doneTasks).toBe(2)
  })

  it('emits log events from adapter logs', async () => {
    const adapter = scriptedAdapter({
      m: [
        { type: 'log', line: 'hello world' },
        { type: 'done' },
      ],
    })
    const engine = createDownloadEngine({ adapter, progressIntervalMs: 0 })
    const logs: string[] = []
    engine.on('log', e => logs.push(e.line))
    await engine.start([{ modelName: 'm', provider: 'ollama' }])
    expect(logs).toContain('hello world')
  })

  it('aggregate overallPercent never reports 100% while any task is still in-flight', async () => {
    // Re-create the dogfood scenario: 3 tasks, 2 done, 1 in-flight whose
    // last layer reported 100% before the next layer / verification fires.
    // Old math returned 100% overall; new math caps in-flight at 99.
    let cont: ((v: void) => void) | null = null
    const blocker = new Promise<void>(r => { cont = r })

    const adapter = (args: AdapterArgs): AsyncIterable<AdapterEvent> => ({
      async *[Symbol.asyncIterator]() {
        if (args.model === 'fast-a' || args.model === 'fast-b') {
          yield { type: 'phase', phase: 'downloading' }
          yield { type: 'layer-progress', digest: args.model, total: 10, completed: 10 }
          yield { type: 'done' }
          return
        }
        // 'slow' — start, report a layer at 100%, then HOLD before
        // emitting verifying/writing/success.
        yield { type: 'phase', phase: 'downloading' }
        yield { type: 'layer-progress', digest: 'first', total: 10, completed: 10 }
        await blocker
        yield { type: 'done' }
      },
    })
    const engine = createDownloadEngine({ adapter, concurrency: 3, progressIntervalMs: 0 })
    const startP = engine.start([
      { modelName: 'fast-a', provider: 'ollama' },
      { modelName: 'fast-b', provider: 'ollama' },
      { modelName: 'slow', provider: 'ollama' },
    ])
    // Wait a tick for fast tasks to finish and slow task to report 100%.
    await new Promise(r => setTimeout(r, 20))
    const mid = engine.snapshot()
    expect(mid.aggregate.doneTasks).toBe(2)
    expect(mid.aggregate.totalTasks).toBe(3)
    // The two done tasks contribute 100 each; the in-flight 'slow' is capped
    // at 99 even though its percent is currently 100. So overall < 100.
    expect(mid.aggregate.overallPercent).toBeLessThan(100)
    expect(mid.aggregate.overallPercent).toBeGreaterThanOrEqual(99)
    cont!()
    const summary = await startP
    expect(summary.succeeded).toHaveLength(3)
    // After all are done, overall is exactly 100.
    expect(engine.snapshot().aggregate.overallPercent).toBe(100)
  })

  it('suppresses noisy `pulling <hash>` log lines (one per Ollama progress tick)', async () => {
    const adapter = scriptedAdapter({
      m: [
        { type: 'phase', phase: 'manifest' },
        { type: 'log', line: 'pulling manifest' },
        { type: 'phase', phase: 'downloading' },
        // These are the spammy lines Ollama emits dozens of times per layer.
        { type: 'log', line: 'pulling dde5aa3fc5ff' },
        { type: 'log', line: 'pulling dde5aa3fc5ff' },
        { type: 'log', line: 'pulling dde5aa3fc5ff' },
        { type: 'log', line: 'pulling 8934d96d3f08' },
        // These should still come through.
        { type: 'log', line: 'verifying sha256 digest' },
        { type: 'log', line: 'writing manifest' },
        { type: 'done' },
      ],
    })
    const engine = createDownloadEngine({ adapter, progressIntervalMs: 0 })
    const logs: string[] = []
    engine.on('log', e => logs.push(e.line))
    await engine.start([{ modelName: 'm', provider: 'ollama' }])
    // None of the pulling-hash lines should reach subscribers.
    expect(logs.filter(l => /^pulling [0-9a-f]{8,}$/i.test(l))).toEqual([])
    // The semantic lines still surface.
    expect(logs).toContain('pulling manifest')
    expect(logs).toContain('verifying sha256 digest')
    expect(logs).toContain('writing manifest')
  })
})
