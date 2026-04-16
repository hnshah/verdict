/**
 * `verdict schedule ...` — manage cron-driven eval schedules.
 *
 * Backed by the `schedules` table (src/db/schema.ts). Schedules are fired
 * by the daemon's scheduler tick (src/daemon/index.ts → tickScheduler).
 */

import chalk from 'chalk'
import {
  getDb,
  initSchema,
  addSchedule,
  listSchedules,
  getScheduleByName,
  removeSchedule,
  updateSchedule,
  addJob,
  type OnRegressionConfig,
} from '../../db/client.js'
import { nextCronTime, isValidCron, describeNext } from '../../scheduler/cron.js'

export interface AddOptions {
  cron: string
  pack?: string[]
  model?: string[]
  category?: string[]
  config?: string
  webhook?: string
  baseline?: string
  disabled?: boolean
}

export async function scheduleAddCommand(name: string, opts: AddOptions): Promise<void> {
  header('schedule add')

  if (!isValidCron(opts.cron)) {
    console.error(chalk.red(`  Invalid cron expression: "${opts.cron}"`))
    console.error(chalk.dim(`  Try "0 9 * * *" or "@hourly" / "@daily" / "@weekly"`))
    process.exit(1)
  }

  const db = getDb()
  initSchema(db)

  if (getScheduleByName(db, name)) {
    console.error(chalk.red(`  Schedule "${name}" already exists.`))
    console.error(chalk.dim(`  Use \`verdict schedule remove ${name}\` first, or pick a different name.`))
    db.close()
    process.exit(1)
  }

  const onReg: OnRegressionConfig | undefined = opts.webhook || opts.baseline
    ? { webhook: opts.webhook, baseline: opts.baseline, stdout: true }
    : undefined

  const next = nextCronTime(opts.cron)
  const id = addSchedule(db, {
    name,
    cron: opts.cron,
    config_path: opts.config ?? null,
    packs: opts.pack?.length ? opts.pack.join(',') : null,
    models: opts.model?.length ? opts.model.join(',') : null,
    category: opts.category?.length ? opts.category.join(',') : null,
    enabled: !opts.disabled,
    on_regression: onReg,
    next_run_at: next ? next.toISOString() : null,
    source: 'cli',
  })

  console.log(chalk.green(`  ✓ Added schedule "${name}" (id=${id})`))
  if (next) console.log(chalk.dim(`    Next run: ${next.toISOString().slice(0, 19).replace('T', ' ')}  (${describeNext(next)})`))
  else console.log(chalk.yellow(`    Next run: <could not compute>`))
  console.log()
  db.close()
}

export interface ListOptions {
  enabled?: boolean
  json?: boolean
}

export async function scheduleListCommand(opts: ListOptions): Promise<void> {
  const db = getDb()
  initSchema(db)
  const rows = listSchedules(db, { enabledOnly: !!opts.enabled })
  db.close()

  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2))
    return
  }

  header('schedule list')

  if (rows.length === 0) {
    console.log(chalk.dim('  No schedules. Use `verdict schedule add <name> --cron "..."` to create one.'))
    console.log()
    return
  }

  const col = (s: string, w: number) => s.slice(0, w).padEnd(w)
  console.log(chalk.dim('  ' + col('NAME', 22) + col('CRON', 16) + col('NEXT', 22) + col('LAST', 22) + col('STATUS', 10) + 'SOURCE'))
  console.log(chalk.dim('  ' + '-'.repeat(100)))

  for (const s of rows) {
    const next = s.enabled ? (s.next_run_at?.slice(0, 19).replace('T', ' ') ?? '-') : '(paused)'
    const last = s.last_run_at?.slice(0, 19).replace('T', ' ') ?? '-'
    const status = s.last_status ?? '-'
    const statusColored = status === 'regression' ? chalk.red(col(status, 10))
      : status === 'error' ? chalk.red(col(status, 10))
      : status === 'ok' ? chalk.green(col(status, 10))
      : chalk.dim(col(status, 10))
    console.log(
      `  ${col(s.name, 22)}${col(s.cron, 16)}${col(next, 22)}${col(last, 22)}${statusColored}${s.source}`
    )
  }
  console.log()
}

export async function scheduleShowCommand(name: string): Promise<void> {
  const db = getDb()
  initSchema(db)
  const s = getScheduleByName(db, name)
  db.close()

  if (!s) {
    console.error(chalk.red(`  Schedule "${name}" not found.`))
    process.exit(1)
  }

  header(`schedule show ${name}`)
  console.log(`  ${chalk.dim('name:')}         ${s.name}`)
  console.log(`  ${chalk.dim('cron:')}         ${s.cron}`)
  console.log(`  ${chalk.dim('enabled:')}      ${s.enabled ? chalk.green('yes') : chalk.yellow('no (paused)')}`)
  console.log(`  ${chalk.dim('source:')}       ${s.source}`)
  if (s.config_path) console.log(`  ${chalk.dim('config:')}       ${s.config_path}`)
  if (s.packs) console.log(`  ${chalk.dim('packs:')}        ${s.packs}`)
  if (s.models) console.log(`  ${chalk.dim('models:')}       ${s.models}`)
  if (s.category) console.log(`  ${chalk.dim('category:')}     ${s.category}`)
  if (s.on_regression) {
    const o = JSON.parse(s.on_regression) as OnRegressionConfig
    console.log(`  ${chalk.dim('on_regression:')}`)
    if (o.webhook) console.log(`    webhook: ${o.webhook}`)
    if (o.baseline) console.log(`    baseline: ${o.baseline}`)
    if (o.stdout !== undefined) console.log(`    stdout: ${o.stdout}`)
  }
  console.log(`  ${chalk.dim('next_run:')}     ${s.next_run_at ?? '-'}`)
  console.log(`  ${chalk.dim('last_run:')}     ${s.last_run_at ?? '-'}`)
  console.log(`  ${chalk.dim('last_status:')}  ${s.last_status ?? '-'}`)
  console.log(`  ${chalk.dim('created_at:')}   ${s.created_at}`)
  console.log()
}

export async function scheduleRemoveCommand(name: string): Promise<void> {
  const db = getDb()
  initSchema(db)
  const removed = removeSchedule(db, name)
  db.close()

  if (!removed) {
    console.error(chalk.red(`  Schedule "${name}" not found.`))
    process.exit(1)
  }
  console.log(chalk.green(`  ✓ Removed schedule "${name}"`))
}

export async function schedulePauseCommand(name: string): Promise<void> {
  await setEnabled(name, false)
}

export async function scheduleResumeCommand(name: string): Promise<void> {
  await setEnabled(name, true)
}

async function setEnabled(name: string, enabled: boolean): Promise<void> {
  const db = getDb()
  initSchema(db)
  const s = getScheduleByName(db, name)
  if (!s) {
    db.close()
    console.error(chalk.red(`  Schedule "${name}" not found.`))
    process.exit(1)
  }
  const next = enabled ? nextCronTime(s.cron) : null
  updateSchedule(db, s.id, {
    enabled: enabled ? 1 : 0,
    next_run_at: next ? next.toISOString() : null,
  })
  db.close()
  console.log(chalk.green(`  ✓ ${enabled ? 'Resumed' : 'Paused'} schedule "${name}"`))
}

export async function scheduleRunCommand(name: string): Promise<void> {
  const db = getDb()
  initSchema(db)
  const s = getScheduleByName(db, name)
  if (!s) {
    db.close()
    console.error(chalk.red(`  Schedule "${name}" not found.`))
    process.exit(1)
  }

  const input: Record<string, unknown> = {}
  if (s.config_path) input['configPath'] = s.config_path
  if (s.packs) input['packs'] = s.packs.split(',').map(x => x.trim()).filter(Boolean)
  if (s.models) input['models'] = s.models.split(',').map(x => x.trim()).filter(Boolean)
  if (s.category) input['category'] = s.category.split(',').map(x => x.trim()).filter(Boolean)

  const jobId = addJob(db, {
    type: 'eval',
    input: JSON.stringify(input),
    priority: 10, // higher than cron-triggered (5) since user invoked explicitly
    metadata: JSON.stringify({ scheduleId: s.id, scheduleName: s.name, manual: true }),
  })
  db.close()

  console.log(chalk.green(`  ✓ Enqueued job ${jobId} for schedule "${name}"`))
  console.log(chalk.dim(`    The daemon must be running (verdict daemon start) for this job to execute.`))
}

export async function scheduleHistoryCommand(name: string): Promise<void> {
  const db = getDb()
  initSchema(db)
  const s = getScheduleByName(db, name)
  if (!s) {
    db.close()
    console.error(chalk.red(`  Schedule "${name}" not found.`))
    process.exit(1)
  }

  // metadata is JSON — match the scheduleId via SQLite LIKE
  const needle = `"scheduleId":${s.id}`
  const rows = db.prepare(
    `SELECT id, status, queued_at, started_at, completed_at, output, error
     FROM jobs
     WHERE metadata LIKE ?
     ORDER BY queued_at DESC
     LIMIT 20`
  ).all(`%${needle}%`) as Array<{
    id: number
    status: string
    queued_at: string
    started_at: string | null
    completed_at: string | null
    output: string | null
    error: string | null
  }>
  db.close()

  header(`schedule history ${name}`)
  if (rows.length === 0) {
    console.log(chalk.dim('  No runs yet.'))
    console.log()
    return
  }

  const col = (s: string, w: number) => s.slice(0, w).padEnd(w)
  console.log(chalk.dim('  ' + col('JOB', 6) + col('STATUS', 10) + col('QUEUED', 22) + 'RESULT'))
  console.log(chalk.dim('  ' + '-'.repeat(80)))
  for (const r of rows) {
    const status = r.status === 'done' ? chalk.green(col(r.status, 10))
      : r.status === 'failed' ? chalk.red(col(r.status, 10))
      : chalk.yellow(col(r.status, 10))
    const queued = r.queued_at.slice(0, 19).replace('T', ' ')
    const summary = r.error ? `error: ${r.error.slice(0, 60)}` : (r.output?.slice(0, 60) ?? '')
    console.log(`  ${col(String(r.id), 6)}${status}${col(queued, 22)}${summary}`)
  }
  console.log()
}

function header(cmd: string): void {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(` ${cmd}`))
  console.log()
}
