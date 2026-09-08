/**
 * `verdict machine inspect` — capture the live state of this machine and
 * print a verdict that the rest of Verdict (and downstream agents) can use to
 * decide whether to keep models warm, run a benchmark, or back off.
 *
 * Exit codes are 0 on any successful inspection. Use `--exit-on=<state>` to
 * make CI scripts fail on a specific verdict; otherwise the verdict shows up
 * in the printed summary and the JSON output but never crashes scripts.
 */

import chalk from 'chalk'
import { createRealProbe, inspect, DEFAULT_THRESHOLDS, assertSupportedPlatform, type MachineSnapshot, type Verdict } from '../../core/machine.js'

interface InspectOpts {
  json?: boolean
  fast?: boolean         // skip the 10 s swap-delta sample
  exitOn?: string        // 'benchmark' | 'unsafe' — comma-separated also accepted
}

const VALID_EXIT_STATES: Verdict[] = ['quiet', 'benchmark', 'unsafe']

export async function machineInspectCommand(opts: InspectOpts): Promise<void> {
  try {
    assertSupportedPlatform()
  } catch (err) {
    const msg = (err as Error).message
    if (opts.json) {
      process.stdout.write(JSON.stringify({ error: msg }) + '\n')
    } else {
      console.error(chalk.red('  ' + msg))
    }
    process.exitCode = 3
    return
  }

  const probe = createRealProbe()
  probe.onSampleStart = (delayMs: number) => {
    if (opts.json) return
    if (delayMs >= 1000) {
      process.stderr.write(chalk.dim(`  sampling swap for ${Math.round(delayMs / 1000)}s...\n`))
    }
  }

  const snap = await inspect(probe, DEFAULT_THRESHOLDS, {
    swapSampleMs: opts.fast ? 0 : 10_000,
  })

  if (opts.json) {
    process.stdout.write(JSON.stringify(snap) + '\n')
  } else {
    printSummary(snap)
  }

  // Default: exit 0 even on `unsafe`. CI scripts opt in to non-zero with --exit-on.
  if (opts.exitOn) {
    const states = opts.exitOn.split(',').map(s => s.trim()).filter(Boolean)
    const bad = states.filter(s => !VALID_EXIT_STATES.includes(s as Verdict))
    if (bad.length > 0) {
      process.stderr.write(chalk.red(`  --exit-on: unknown state(s): ${bad.join(', ')} (valid: ${VALID_EXIT_STATES.join(', ')})\n`))
      process.exitCode = 3
      return
    }
    if (states.includes(snap.verdict.state)) process.exitCode = 1
  }
}

function badge(state: Verdict): string {
  if (state === 'quiet') return chalk.bgGreen.black(' QUIET ')
  if (state === 'benchmark') return chalk.bgYellow.black(' BENCHMARK ')
  return chalk.bgRed.white(' UNSAFE ')
}

function pressureBadge(p: 'normal' | 'warn' | 'critical'): string {
  if (p === 'normal') return chalk.green(p)
  if (p === 'warn') return chalk.yellow(p)
  return chalk.red(p)
}

function printSummary(s: MachineSnapshot): void {
  const hw = s.hardware
  console.log()
  console.log('  ' + chalk.bold('verdict') + chalk.dim(' machine inspect'))
  console.log()
  console.log('  ' + badge(s.verdict.state) + '  ' + chalk.dim(s.verdict.reasons.join(' / ')))
  console.log()
  console.log('  ' + chalk.dim('hardware  ') + `${hw.cpu} - ${hw.cpu_cores} cores - ${hw.ram_gb} GB ${hw.unified_memory ? '(unified)' : ''} - ${hw.os} ${hw.os_version}`)
  console.log('  ' + chalk.dim('load      ') + `${s.load.load1.toFixed(2)} / ${s.load.load5.toFixed(2)} / ${s.load.load15.toFixed(2)}  ` + chalk.dim(`(load1/core ${s.load.load1_per_core.toFixed(2)})`))
  const presSrc = s.memory.pressure_source === 'sysctl' ? '' : chalk.dim(` [${s.memory.pressure_source}]`)
  console.log('  ' + chalk.dim('memory    ') + `pressure ${pressureBadge(s.memory.pressure)}${presSrc}  ` + chalk.dim(`free ${s.memory.free_pct.toFixed(0)}% / compressed ${s.memory.compressed_pct.toFixed(0)}% / wired ${s.memory.wired_pct.toFixed(0)}%`))
  const deltaTxt = s.swap.delta_mb_over_sample === undefined
    ? chalk.dim('(no sample)')
    : `${s.swap.delta_mb_over_sample >= 0 ? '+' : ''}${s.swap.delta_mb_over_sample.toFixed(0)} MB over ${Math.round(s.swap.sample_ms / 1000)}s`
  console.log('  ' + chalk.dim('swap      ') + `${s.swap.used_mb.toFixed(0)} / ${s.swap.total_mb.toFixed(0)} MB used - ${deltaTxt}`)
  console.log('  ' + chalk.dim('disk      ') + `${s.disk.free_gb.toFixed(1)} GB free ` + chalk.dim(`(reserve ${s.disk.min_reserve_gb} GB)`))
  if (s.ollama.available) {
    const runningPart = s.ollama.running.length > 0
      ? `${s.ollama.running.length} running (${s.ollama.running_total_gb.toFixed(1)} GB)`
      : '0 running'
    console.log('  ' + chalk.dim('ollama    ') + `${s.ollama.installed.length} installed - ${s.ollama.installed_total_gb.toFixed(1)} GB on disk - ${runningPart}`)
  } else {
    console.log('  ' + chalk.dim('ollama    ') + chalk.dim('not installed'))
  }
  console.log()
}
