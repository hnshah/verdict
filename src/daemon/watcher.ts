/**
 * Model watcher — polls local inference backends for new/removed models
 * and optionally auto-queues eval jobs for new detections.
 */

import type Database from 'better-sqlite3'
import { addJob } from '../db/client.js'

export interface WatchEvent {
  type: 'added' | 'removed' | 'updated'
  provider: 'ollama' | 'mlx' | 'lmstudio'
  modelId: string
  model: string
  autoEvalQueued?: boolean
}

interface WatchedModelRow {
  id: number
  model_id: string
  provider: string
  first_detected: string
  last_seen: string | null
  auto_eval: number
  eval_pack: string
}

export class ModelWatcher {
  private db: Database.Database
  private pollIntervalMs: number

  constructor(db: Database.Database, opts?: { pollIntervalMs?: number }) {
    this.db = db
    this.pollIntervalMs = opts?.pollIntervalMs ?? 60_000
  }

  getPollIntervalMs(): number {
    return this.pollIntervalMs
  }

  /** Poll all backends and diff against known models. */
  async poll(): Promise<WatchEvent[]> {
    const events: WatchEvent[] = []
    const discovered = new Map<string, { provider: 'ollama' | 'mlx' | 'lmstudio'; model: string }>()

    // Ollama
    try {
      const resp = await fetch('http://localhost:11434/api/tags')
      const data = await resp.json() as { models?: Array<{ name: string }> }
      for (const m of data.models ?? []) {
        discovered.set(`ollama:${m.name}`, { provider: 'ollama', model: m.name })
      }
    } catch { /* not running */ }

    // MLX
    try {
      const resp = await fetch('http://localhost:8080/v1/models')
      const data = await resp.json() as { data?: Array<{ id: string }> }
      for (const m of data.data ?? []) {
        discovered.set(`mlx:${m.id}`, { provider: 'mlx', model: m.id })
      }
    } catch { /* not running */ }

    // LM Studio
    try {
      const resp = await fetch('http://localhost:1234/v1/models')
      const data = await resp.json() as { data?: Array<{ id: string }> }
      for (const m of data.data ?? []) {
        discovered.set(`lmstudio:${m.id}`, { provider: 'lmstudio', model: m.id })
      }
    } catch { /* not running */ }

    const known = this.getKnownModelsMap()
    const now = new Date().toISOString()

    // Detect new models
    for (const [key, info] of discovered) {
      if (!known.has(key)) {
        // New model detected
        const autoEval = this.getAutoEvalDefault()
        this.db.prepare(`
          INSERT OR IGNORE INTO watched_models (model_id, provider, first_detected, last_seen, auto_eval)
          VALUES (?, ?, ?, ?, ?)
        `).run(key, info.provider, now, now, autoEval ? 1 : 0)

        let autoEvalQueued = false
        if (autoEval) {
          const evalPack = (this.db.prepare(
            'SELECT eval_pack FROM watched_models WHERE model_id = ?'
          ).get(key) as { eval_pack: string } | undefined)?.eval_pack ?? 'general'

          addJob(this.db, {
            type: 'eval',
            model_id: info.model,
            input: JSON.stringify({ configPath: './verdict.yaml', models: [info.model], pack: evalPack }),
            priority: 1,
          })
          autoEvalQueued = true
        }

        events.push({
          type: 'added',
          provider: info.provider,
          modelId: key,
          model: info.model,
          autoEvalQueued,
        })
      } else {
        // Update last_seen
        this.db.prepare(
          'UPDATE watched_models SET last_seen = ? WHERE model_id = ?'
        ).run(now, key)
      }
    }

    // Detect removed models
    for (const [key, row] of known) {
      if (!discovered.has(key)) {
        events.push({
          type: 'removed',
          provider: row.provider as 'ollama' | 'mlx' | 'lmstudio',
          modelId: key,
          model: key.split(':').slice(1).join(':'),
        })
      }
    }

    return events
  }

  /** Get all known model IDs. */
  async getKnownModels(): Promise<string[]> {
    const rows = this.db.prepare('SELECT model_id FROM watched_models').all() as Array<{ model_id: string }>
    return rows.map(r => r.model_id)
  }

  private getKnownModelsMap(): Map<string, WatchedModelRow> {
    const rows = this.db.prepare('SELECT * FROM watched_models').all() as WatchedModelRow[]
    const map = new Map<string, WatchedModelRow>()
    for (const row of rows) map.set(row.model_id, row)
    return map
  }

  private getAutoEvalDefault(): boolean {
    return true
  }
}
