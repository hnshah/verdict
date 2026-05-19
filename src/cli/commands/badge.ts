/**
 * verdict badge <result.json> — emit an SVG score badge.
 *
 * Usage:
 *   verdict badge results/latest.json > docs/verdict-badge.svg
 *   verdict badge results/latest.json --label "verdict" --show-model
 */

import fs from 'fs'
import path from 'path'
import { generateBadge } from '../../reporter/badge.js'
import type { RunResult } from '../../types/index.js'

export interface BadgeOptions {
  label?: string
  showModel?: boolean
  output?: string
}

export async function badgeCommand(resultPath: string, opts: BadgeOptions): Promise<void> {
  const resolved = path.resolve(resultPath)
  if (!fs.existsSync(resolved)) {
    console.error(`badge: result file not found: ${resultPath}`)
    process.exit(1)
  }
  let result: RunResult
  try {
    result = JSON.parse(fs.readFileSync(resolved, 'utf-8'))
  } catch (err) {
    console.error(`badge: failed to parse ${resultPath}: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
  const svg = generateBadge(result, {
    label: opts.label,
    showModel: opts.showModel,
  })
  if (opts.output) {
    fs.mkdirSync(path.dirname(path.resolve(opts.output)), { recursive: true })
    fs.writeFileSync(opts.output, svg)
    console.error(`badge: wrote ${opts.output}`) // stderr so stdout stays clean if pipelined
  } else {
    process.stdout.write(svg)
  }
}
