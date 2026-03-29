/**
 * Core daemon worker — processes jobs from the SQLite queue.
 * Runs serially (one job at a time) to prevent OOM on local hardware.
 */

import type Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getDb, initSchema, getNextJob, updateJob, getJobs } from '../db/client.js'
import type { JobRow } from '../db/client.js'
import { selectModel } from '../router/selector.js'
import { callModel } from '../providers/compat.js'
import type { ModelConfig } from '../types/index.js'
import { buildModelConfig } from '../utils/model-config.js'

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
  private startedAt: number = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(opts?: { pollIntervalMs?: number; db?: Database.Database }) {
    this.pollIntervalMs = opts?.pollIntervalMs ?? 5000
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
    this.poll()
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
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
      const output = await this.runJob(job)
      const completedAt = new Date().toISOString()
      updateJob(this.db, job.id, { status: 'done', output, completed_at: completedAt })
      this.log(`[job:${job.id}] done`)
    } catch (err) {
      const completedAt = new Date().toISOString()
      const errorMsg = err instanceof Error ? err.message : String(err)
      updateJob(this.db, job.id, { status: 'failed', error: errorMsg, completed_at: completedAt })
      this.log(`[job:${job.id}] failed: ${errorMsg}`)
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
    const packNames = input['pack'] ? [input['pack'] as string] : config.packs
    const packs = packNames.map(p => loadEvalPack(p, configDir))

    const result = await runEvals(config, packs, msg => this.log(`  ${msg}`))

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
}
