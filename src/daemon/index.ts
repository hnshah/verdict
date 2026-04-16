/**
 * Core daemon worker — processes jobs from the SQLite queue.
 * Runs serially (one job at a time) to prevent OOM on local hardware.
 */

import type Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import os from 'os'
import yaml from 'js-yaml'
import {
  getDb,
  initSchema,
  getNextJob,
  updateJob,
  addJob,
  getDueSchedules,
  updateSchedule,
  upsertSchedule,
  removeYamlSchedules,
} from '../db/client.js'
import type { JobRow, ScheduleRow, OnRegressionConfig } from '../db/client.js'
import { selectModel } from '../router/selector.js'
import { callModel } from '../providers/compat.js'
import { buildModelConfig } from '../utils/model-config.js'
import { nextCronTime, isValidCron } from '../scheduler/cron.js'
import { notifyRegression } from '../notify/index.js'
import type { RunResult } from '../types/index.js'

export interface DaemonStatus {
  running: boolean
  pid?: number
  currentJob: { id: number; type: string; model?: string } | null
  queueDepth: number
  completedToday: number
  failedToday: number
  uptimeSeconds?: number
}

const VERDICT_DIR = path.join(os.homedir(), '.verdict')
const PID_FILE = path.join(VERDICT_DIR, 'daemon.pid')
const LOG_FILE = path.join(VERDICT_DIR, 'daemon.log')

export { PID_FILE, LOG_FILE, VERDICT_DIR }

function ensureDir(): void {
  if (!fs.existsSync(VERDICT_DIR)) fs.mkdirSync(VERDICT_DIR, { recursive: true })
}


export class VerdictDaemon {
  private db: Database.Database
  private running = false
  private currentJobId: number | null = null
  private pollIntervalMs: number
  private schedulerIntervalMs: number
  private startedAt: number = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private schedulerTimer: ReturnType<typeof setInterval> | null = null
  // Holds the last RunResult produced by runEvalJob so processNextJob can
  // forward it to notifyRegression when the job originated from a schedule.
  private lastEvalResult: RunResult | null = null

  constructor(opts?: {
    pollIntervalMs?: number
    schedulerIntervalMs?: number
    db?: Database.Database
  }) {
    this.pollIntervalMs = opts?.pollIntervalMs ?? 5000
    // Cron granularity is minutes, so a 60s scheduler tick is sufficient.
    this.schedulerIntervalMs = opts?.schedulerIntervalMs ?? 60_000
    if (opts?.db) {
      this.db = opts.db
    } else {
      this.db = getDb()
    }
    initSchema(this.db)
  }

  start(): void {
    if (this.running) return
    ensureDir()
    this.running = true
    this.startedAt = Date.now()
    fs.writeFileSync(PID_FILE, String(process.pid))
    // Sync declarative YAML schedules into the DB at startup so they're
    // always a mirror of verdict.yaml (CLI-created schedules are preserved).
    try {
      const synced = this.syncYamlSchedules('./verdict.yaml')
      if (synced > 0) this.log(`synced ${synced} schedule(s) from verdict.yaml`)
    } catch (err) {
      this.log(`yaml schedule sync skipped: ${err instanceof Error ? err.message : String(err)}`)
    }
    this.poll()
    // Run an initial scheduler tick immediately so just-now-due schedules
    // don't wait a full interval.
    this.tickScheduler()
    this.schedulerTimer = setInterval(() => this.tickScheduler(), this.schedulerIntervalMs)
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer)
      this.schedulerTimer = null
    }
    try { fs.unlinkSync(PID_FILE) } catch { /* already gone */ }
  }

  isRunning(): boolean {
    return this.running
  }

  getStatus(): DaemonStatus {
    const today = new Date().toISOString().slice(0, 10)
    const queueDepth = (this.db.prepare(
      `SELECT COUNT(*) as c FROM jobs WHERE status = 'queued'`
    ).get() as { c: number }).c

    const completedToday = (this.db.prepare(
      `SELECT COUNT(*) as c FROM jobs WHERE status = 'done' AND completed_at >= ?`
    ).get(today) as { c: number }).c

    const failedToday = (this.db.prepare(
      `SELECT COUNT(*) as c FROM jobs WHERE status = 'failed' AND completed_at >= ?`
    ).get(today) as { c: number }).c

    let currentJob: DaemonStatus['currentJob'] = null
    if (this.currentJobId !== null) {
      const job = this.db.prepare('SELECT id, type, model_id FROM jobs WHERE id = ?').get(this.currentJobId) as { id: number; type: string; model_id: string | null } | undefined
      if (job) {
        currentJob = { id: job.id, type: job.type, model: job.model_id ?? undefined }
      }
    }

    return {
      running: this.running,
      pid: process.pid,
      currentJob,
      queueDepth,
      completedToday,
      failedToday,
      uptimeSeconds: this.running ? Math.floor((Date.now() - this.startedAt) / 1000) : undefined,
    }
  }

  private poll(): void {
    if (!this.running) return
    this.processNextJob()
      .catch(err => {
        this.log(`Poll error: ${err instanceof Error ? err.message : String(err)}`)
      })
      .finally(() => {
        if (this.running) {
          this.timer = setTimeout(() => this.poll(), this.pollIntervalMs)
        }
      })
  }

  private async processNextJob(): Promise<void> {
    const job = getNextJob(this.db)
    if (!job) return

    this.currentJobId = job.id
    const now = new Date().toISOString()
    updateJob(this.db, job.id, { status: 'running', started_at: now })
    this.log(`[job:${job.id}] starting type=${job.type}`)

    try {
      this.lastEvalResult = null
      const output = await this.runJob(job)
      const completedAt = new Date().toISOString()
      updateJob(this.db, job.id, { status: 'done', output, completed_at: completedAt })
      this.log(`[job:${job.id}] done`)
      // If this job originated from a schedule, run notifications + mark status
      if (job.type === 'eval') await this.onEvalJobDone(job)
    } catch (err) {
      const completedAt = new Date().toISOString()
      const errorMsg = err instanceof Error ? err.message : String(err)
      updateJob(this.db, job.id, { status: 'failed', error: errorMsg, completed_at: completedAt })
      this.log(`[job:${job.id}] failed: ${errorMsg}`)
      // Still mark the schedule's last_status so the TUI/CLI can surface errors
      this.markScheduleStatus(job, 'error')
    } finally {
      this.currentJobId = null
    }
  }

  private async runJob(job: JobRow): Promise<string> {
    const input = job.input ? JSON.parse(job.input) as Record<string, unknown> : {}

    switch (job.type) {
      case 'eval':
        return this.runEvalJob(input)
      case 'summarize':
        return this.runSummarizeJob(input)
      case 'research':
        return this.runResearchJob(input)
      case 'batch':
        return this.runBatchJob(input)
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }
  }

  private async runEvalJob(input: Record<string, unknown>): Promise<string> {
    const configPath = (input['configPath'] as string) ?? './verdict.yaml'
    const { loadConfig, loadEvalPack } = await import('../core/config.js')
    const { runEvals } = await import('../core/runner.js')
    const { saveRunResult } = await import('../db/client.js')

    const config = loadConfig(configPath)

    if (input['models']) {
      const ids = (input['models'] as string[])
      config.models = config.models.filter(m => ids.includes(m.id))
    }

    const configDir = path.dirname(path.resolve(configPath))
    // Accept either `pack` (legacy singular) or `packs` (array, from schedules)
    let packNames: string[]
    if (Array.isArray(input['packs']) && (input['packs'] as unknown[]).length > 0) {
      packNames = input['packs'] as string[]
    } else if (input['pack']) {
      packNames = [input['pack'] as string]
    } else {
      packNames = config.packs
    }
    const packs = packNames.map(p => loadEvalPack(p, configDir))

    const result = await runEvals(config, packs, msg => this.log(`  ${msg}`))
    this.lastEvalResult = result

    const packLabel = (packNames[0] ?? 'unknown').replace(/^.*\//, '').replace(/\.ya?ml$/, '')
    saveRunResult(this.db, result, packLabel)

    const topModel = result.models
      .map(id => result.summary[id])
      .filter(Boolean)
      .sort((a, b) => b.avg_total - a.avg_total)[0]

    return topModel
      ? `${topModel.model_id}: ${topModel.avg_total.toFixed(1)}/10 (${result.cases.length} cases)`
      : 'No results'
  }

  private async runSummarizeJob(input: Record<string, unknown>): Promise<string> {
    const text = input['text'] as string | undefined
    const maxWords = (input['maxWords'] as number) ?? 200

    if (!text) throw new Error('Summarize job requires "text" field in input')

    const selected = selectModel(this.db, { taskType: 'summarize' })
    if (!selected) throw new Error('No model available for summarization — run evals first')

    const modelConfig = buildModelConfig(selected.modelId, selected.provider)
    const prompt = `Summarize the following text in ${maxWords} words or fewer:\n\n${text}`
    const response = await callModel(modelConfig, prompt)

    if (response.error) throw new Error(response.error)
    return response.text
  }

  private async runResearchJob(input: Record<string, unknown>): Promise<string> {
    const query = input['query'] as string
    if (!query) throw new Error('Research job requires "query" field in input')

    // Fetch instant answer from DuckDuckGo
    let ddgContext = ''
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
      const resp = await fetch(url)
      const data = await resp.json() as Record<string, unknown>
      const abstract = data['Abstract'] as string
      const relatedTopics = data['RelatedTopics'] as Array<{ Text?: string }> | undefined
      if (abstract) ddgContext += `Abstract: ${abstract}\n`
      if (relatedTopics) {
        for (const t of relatedTopics.slice(0, 5)) {
          if (t.Text) ddgContext += `- ${t.Text}\n`
        }
      }
    } catch {
      ddgContext = '(web search unavailable)'
    }

    const selected = selectModel(this.db, { taskType: 'general' })
    if (!selected) throw new Error('No model available for research — run evals first')

    const modelConfig = buildModelConfig(selected.modelId, selected.provider)
    const prompt = `Research the following question and provide a comprehensive answer.\n\nQuestion: ${query}\n\nWeb context:\n${ddgContext}\n\nProvide a thorough, well-structured answer.`
    const response = await callModel(modelConfig, prompt)

    if (response.error) throw new Error(response.error)
    return response.text
  }

  private async runBatchJob(input: Record<string, unknown>): Promise<string> {
    const prompts = input['prompts'] as string[]
    if (!prompts || !Array.isArray(prompts)) throw new Error('Batch job requires "prompts" array in input')

    const selected = selectModel(this.db, { taskType: 'general' })
    if (!selected) throw new Error('No model available for batch — run evals first')

    const modelConfig = buildModelConfig(selected.modelId, selected.provider)
    const results: string[] = []

    for (const prompt of prompts) {
      const response = await callModel(modelConfig, prompt)
      results.push(response.error ? `[error] ${response.error}` : response.text)
    }

    const outputPath = input['outputPath'] as string | undefined
    const output = results.join('\n---\n')
    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, output)
      return `Wrote ${results.length} results to ${outputPath}`
    }

    return output
  }

  private log(msg: string): void {
    const ts = new Date().toISOString()
    const line = `[${ts}] ${msg}\n`
    ensureDir()
    fs.appendFileSync(LOG_FILE, line)
  }

  /**
   * Post-eval-success hook. If the job carried a scheduleId in its metadata,
   * detect regressions against the configured baseline, dispatch webhooks,
   * and write `last_run_id` / `last_status` back to the schedules row.
   */
  private async onEvalJobDone(job: JobRow): Promise<void> {
    const meta = parseScheduleMetadata(job.metadata)
    if (!meta) return
    const scheduleRow = this.db.prepare(
      `SELECT * FROM schedules WHERE id = ? LIMIT 1`
    ).get(meta.scheduleId) as ScheduleRow | undefined
    if (!scheduleRow) return

    const result = this.lastEvalResult
    let status: 'ok' | 'regression' | 'error' = 'ok'

    if (result) {
      try {
        const outcome = await notifyRegression({
          schedule: scheduleRow,
          result,
          log: (m) => this.log(m),
        })
        if (outcome.report?.regressed) status = 'regression'
      } catch (err) {
        this.log(`[schedule:${scheduleRow.name}] notify failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    updateSchedule(this.db, scheduleRow.id, {
      last_run_id: result?.run_id ?? null,
      last_status: status,
    })
  }

  /** Mark a schedule's last_status when its associated job failed. */
  private markScheduleStatus(job: JobRow, status: 'error'): void {
    const meta = parseScheduleMetadata(job.metadata)
    if (!meta) return
    const row = this.db.prepare(
      `SELECT id FROM schedules WHERE id = ? LIMIT 1`
    ).get(meta.scheduleId) as { id: number } | undefined
    if (!row) return
    updateSchedule(this.db, row.id, { last_status: status })
  }

  /**
   * Walk every enabled, due schedule and enqueue an `eval` job for it.
   * The job input carries the schedule's filters, while metadata carries the
   * schedule id so the worker can post-run notify on regressions.
   * Also advances the schedule's next_run_at to the cron's next fire time.
   *
   * Exposed for testing (invoke after manually setting next_run_at).
   */
  tickScheduler(now: Date = new Date()): number {
    if (!this.running) return 0
    const due = getDueSchedules(this.db, now)
    let fired = 0
    for (const sched of due) {
      try {
        this.fireSchedule(sched, now)
        fired++
      } catch (err) {
        this.log(`[schedule:${sched.name}] fire failed: ${err instanceof Error ? err.message : String(err)}`)
        updateSchedule(this.db, sched.id, { last_status: 'error' })
      }
    }
    return fired
  }

  private fireSchedule(sched: ScheduleRow, now: Date): void {
    const input: Record<string, unknown> = {}
    if (sched.config_path) input['configPath'] = sched.config_path
    if (sched.packs) input['packs'] = sched.packs.split(',').map(s => s.trim()).filter(Boolean)
    if (sched.models) input['models'] = sched.models.split(',').map(s => s.trim()).filter(Boolean)
    if (sched.category) input['category'] = sched.category.split(',').map(s => s.trim()).filter(Boolean)

    const jobId = addJob(this.db, {
      type: 'eval',
      input: JSON.stringify(input),
      priority: 5,
      metadata: JSON.stringify({ scheduleId: sched.id, scheduleName: sched.name }),
    })

    const next = nextCronTime(sched.cron, now)
    updateSchedule(this.db, sched.id, {
      next_run_at: next ? next.toISOString() : null,
      last_run_at: now.toISOString(),
    })
    this.log(`[schedule:${sched.name}] enqueued job ${jobId}; next=${next?.toISOString() ?? 'none'}`)
  }

  /**
   * Load `verdict.yaml` and upsert its `schedules:` block into the DB.
   * - YAML-declared schedules always overwrite existing rows (keyed by name).
   * - YAML-declared schedules that were removed from the file are deleted
   *   (so the config file remains the source of truth).
   * - CLI-created schedules (source='cli') are untouched.
   *
   * Returns the number of schedules upserted.
   */
  syncYamlSchedules(configPath: string): number {
    if (!fs.existsSync(configPath)) return 0
    // Lazy-load to avoid pulling the whole config module when no config exists
    const yamlContent = fs.readFileSync(configPath, 'utf8')
    // Minimal parse for just the `schedules:` field — use the same resolver
    // the main config uses so env-var substitution works.
    let parsed: unknown
    try {
      parsed = yaml.load(yamlContent)
    } catch {
      return 0
    }

    const raw = (parsed as Record<string, unknown> | null)?.['schedules']
    if (!Array.isArray(raw)) {
      // No schedules block — drop any stale yaml rows
      removeYamlSchedules(this.db)
      return 0
    }

    // Drop stale yaml rows first (schedules removed from the file)
    removeYamlSchedules(this.db)

    let count = 0
    for (const item of raw) {
      const entry = item as Record<string, unknown>
      const name = entry['name']
      const cron = entry['cron']
      if (typeof name !== 'string' || typeof cron !== 'string' || !isValidCron(cron)) {
        this.log(`skipping invalid schedule entry: name=${String(name)} cron=${String(cron)}`)
        continue
      }
      const next = nextCronTime(cron)
      upsertSchedule(this.db, {
        name,
        cron,
        config_path: typeof entry['config_path'] === 'string' ? (entry['config_path'] as string) : null,
        packs: Array.isArray(entry['packs']) ? (entry['packs'] as string[]).join(',') : null,
        models: Array.isArray(entry['models']) ? (entry['models'] as string[]).join(',') : null,
        category: Array.isArray(entry['category']) ? (entry['category'] as string[]).join(',') : null,
        enabled: entry['enabled'] !== false,
        on_regression: (entry['on_regression'] ?? null) as OnRegressionConfig | null,
        next_run_at: next ? next.toISOString() : null,
        source: 'yaml',
      })
      count++
    }
    return count
  }
}

/**
 * Parse the `metadata` blob attached to a job row. Only jobs enqueued by the
 * scheduler tick or `verdict schedule run` will have a `scheduleId` field.
 */
function parseScheduleMetadata(metadata: string | null): { scheduleId: number; scheduleName: string } | null {
  if (!metadata) return null
  try {
    const obj = JSON.parse(metadata) as Record<string, unknown>
    if (typeof obj['scheduleId'] !== 'number') return null
    return {
      scheduleId: obj['scheduleId'] as number,
      scheduleName: (obj['scheduleName'] as string) ?? String(obj['scheduleId']),
    }
  } catch {
    return null
  }
}
