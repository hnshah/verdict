import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema } from '../../db/client.js'
import { ModelWatcher } from '../watcher.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  return db
}

// Mock fetch globally
const originalFetch = globalThis.fetch

describe('ModelWatcher', () => {
  let db: Database.Database
  let watcher: ModelWatcher

  beforeEach(() => {
    db = createTestDb()
    watcher = new ModelWatcher(db, { pollIntervalMs: 1000 })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns empty events when no backends are running', async () => {
    // Mock all fetches to fail (backends not running)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const events = await watcher.poll()
    expect(events).toEqual([])
  })

  it('detects new Ollama models', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('11434')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            models: [{ name: 'qwen2.5:7b' }, { name: 'llama4:8b' }],
          }),
        })
      }
      return Promise.reject(new Error('not running'))
    })

    const events = await watcher.poll()
    expect(events.length).toBe(2)
    expect(events[0].type).toBe('added')
    expect(events[0].provider).toBe('ollama')
    expect(events[0].model).toBe('qwen2.5:7b')
    expect(events[1].model).toBe('llama4:8b')
  })

  it('detects new MLX models', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('8080')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            data: [{ id: 'mlx-community/Llama-3.2-3B-Instruct-4bit' }],
          }),
        })
      }
      return Promise.reject(new Error('not running'))
    })

    const events = await watcher.poll()
    expect(events.length).toBe(1)
    expect(events[0].provider).toBe('mlx')
    expect(events[0].model).toBe('mlx-community/Llama-3.2-3B-Instruct-4bit')
  })

  it('detects new LM Studio models', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('1234')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            data: [{ id: 'phi-3-mini-4k-instruct' }],
          }),
        })
      }
      return Promise.reject(new Error('not running'))
    })

    const events = await watcher.poll()
    expect(events.length).toBe(1)
    expect(events[0].provider).toBe('lmstudio')
  })

  it('does not re-report known models on subsequent polls', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('11434')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            models: [{ name: 'qwen2.5:7b' }],
          }),
        })
      }
      return Promise.reject(new Error('not running'))
    })

    const events1 = await watcher.poll()
    expect(events1.length).toBe(1)

    const events2 = await watcher.poll()
    expect(events2.length).toBe(0)
  })

  it('detects removed models', async () => {
    // First poll with a model
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('11434')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            models: [{ name: 'qwen2.5:7b' }],
          }),
        })
      }
      return Promise.reject(new Error('not running'))
    })

    await watcher.poll()

    // Second poll without the model
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('not running'))

    const events = await watcher.poll()
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('removed')
  })

  it('auto-queues eval jobs for new models', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('11434')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            models: [{ name: 'qwen2.5:7b' }],
          }),
        })
      }
      return Promise.reject(new Error('not running'))
    })

    const events = await watcher.poll()
    expect(events[0].autoEvalQueued).toBe(true)

    // Check that a job was added
    const jobs = db.prepare("SELECT * FROM jobs WHERE type = 'eval'").all()
    expect(jobs.length).toBe(1)
  })

  it('returns known models list', async () => {
    // Insert some models
    db.prepare(
      "INSERT INTO watched_models (model_id, provider) VALUES (?, ?)"
    ).run('ollama:qwen2.5:7b', 'ollama')
    db.prepare(
      "INSERT INTO watched_models (model_id, provider) VALUES (?, ?)"
    ).run('mlx:llama3', 'mlx')

    const models = await watcher.getKnownModels()
    expect(models.length).toBe(2)
    expect(models).toContain('ollama:qwen2.5:7b')
    expect(models).toContain('mlx:llama3')
  })
})
