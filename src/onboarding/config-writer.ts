/**
 * Render verdict.yaml from a Plan, show the user a diff against any existing
 * file, and (on commit) write atomically with a timestamped backup of the
 * prior file.
 *
 * Never blind-writes. Always temp-file + rename for atomicity.
 */

import fs from 'fs'
import path from 'path'
import { renderVerdictYamlFromPlan } from './templates.js'
import {
  GENERAL_PACK,
  MOE_PACK,
  ENV_EXAMPLE,
  loadQuantizationPack,
  QUANTIZATION_PACK_STUB,
} from './templates.js'
import type { Plan } from './events.js'

export type ConfigWriteAction =
  | 'create'
  | 'merge'
  | 'replace-with-backup'
  | 'leave'

export interface ConfigWritePlan {
  action: ConfigWriteAction
  /** What we would write (only the new YAML — merge resolves at commit time). */
  preview: string
  /** Unified diff vs existing, or null when there's no existing file. */
  diff: string | null
  hasExisting: boolean
  targetPath: string
}

export interface ConfigWriteResult {
  action: ConfigWriteAction
  finalPath: string
  backupPath?: string
  bytesWritten: number
}

// ─── Planning ───────────────────────────────────────────────────────────────

export function planConfigWrite(plan: Plan): ConfigWritePlan {
  const target = path.resolve(plan.config.targetPath)
  const hasExisting = fs.existsSync(target)
  const preview = renderVerdictYamlFromPlan(plan)
  let diff: string | null = null
  if (hasExisting) {
    const existing = safeRead(target)
    diff = unifiedDiff(existing, preview, target)
  }
  return {
    action: plan.config.action,
    preview,
    diff,
    hasExisting,
    targetPath: target,
  }
}

// ─── Commit ─────────────────────────────────────────────────────────────────

export interface CommitOptions {
  /** Skip writing eval-pack and .env.example files (for test isolation). */
  skipScaffold?: boolean
}

export function commitConfigWrite(
  plan: Plan,
  writePlan: ConfigWritePlan,
  opts: CommitOptions = {}
): ConfigWriteResult {
  const target = writePlan.targetPath
  const dir = path.dirname(target)
  fs.mkdirSync(dir, { recursive: true })

  // 1. "leave" — no-op.
  if (writePlan.action === 'leave') {
    return { action: 'leave', finalPath: target, bytesWritten: 0 }
  }

  // 2. Back up existing file if we're replacing it.
  let backupPath: string | undefined
  if (writePlan.hasExisting && writePlan.action === 'replace-with-backup') {
    backupPath = `${target}.bak.${Date.now()}`
    fs.copyFileSync(target, backupPath)
  }

  // 3. Resolve final YAML content.
  let yamlOut: string
  if (writePlan.action === 'merge' && writePlan.hasExisting) {
    yamlOut = mergeYaml(safeRead(target), writePlan.preview)
  } else {
    yamlOut = writePlan.preview
  }

  // 4. Atomic write: tmp + rename.
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`
  fs.writeFileSync(tmp, yamlOut)
  fs.renameSync(tmp, target)

  // 5. Scaffold eval-packs and .env.example next to verdict.yaml (idempotent).
  if (!opts.skipScaffold) {
    scaffoldExtras(dir)
  }

  return {
    action: writePlan.action,
    finalPath: target,
    backupPath,
    bytesWritten: Buffer.byteLength(yamlOut, 'utf-8'),
  }
}

function scaffoldExtras(rootDir: string): void {
  const packsDir = path.join(rootDir, 'eval-packs')
  const resultsDir = path.join(rootDir, 'results')
  fs.mkdirSync(packsDir, { recursive: true })
  fs.mkdirSync(resultsDir, { recursive: true })

  const generalPath = path.join(packsDir, 'general.yaml')
  if (!fs.existsSync(generalPath)) fs.writeFileSync(generalPath, GENERAL_PACK)

  const moePath = path.join(packsDir, 'moe.yaml')
  if (!fs.existsSync(moePath)) fs.writeFileSync(moePath, MOE_PACK)

  // Mirror `verdict init`: write the quantization pack from the bundled
  // file when available, fall back to a pointer stub. Without this,
  // `verdict quants` later breaks for users who came in through onboarding.
  const quantPath = path.join(packsDir, 'quantization.yaml')
  if (!fs.existsSync(quantPath)) {
    fs.writeFileSync(quantPath, loadQuantizationPack() ?? QUANTIZATION_PACK_STUB)
  }

  const envExamplePath = path.join(rootDir, '.env.example')
  if (!fs.existsSync(envExamplePath)) fs.writeFileSync(envExamplePath, ENV_EXAMPLE)
}

// ─── Merge ──────────────────────────────────────────────────────────────────

/**
 * Conservative merge: keep the existing file as-is, but inject any models
 * from `incoming` whose `id:` doesn't appear in the existing file. The merge
 * is line-based and only touches the `models:` section. If we can't find an
 * obvious `models:` block, we fall back to keeping the existing file
 * unchanged and appending a comment with the new models below.
 *
 * This is deliberately simple — we don't parse-and-re-emit (that would lose
 * the user's comments). Users can always pick 'replace-with-backup' for a
 * full overwrite.
 */
export function mergeYaml(existing: string, incoming: string): string {
  const existingIds = collectModelIds(existing)
  const incomingBlocks = extractModelBlocks(incoming)
  const newBlocks = incomingBlocks.filter(b => !existingIds.has(b.id))
  if (newBlocks.length === 0) return existing

  const lines = existing.split('\n')
  const modelsIdx = lines.findIndex(l => /^models:\s*$/.test(l))
  if (modelsIdx === -1) {
    // No models: block found — append below with a marker comment.
    return (
      existing.trimEnd() +
      '\n\n# Added by verdict onboarding:\nmodels:\n' +
      newBlocks.map(b => b.text).join('\n') +
      '\n'
    )
  }

  // Find the end of the models: block (next top-level key at column 0).
  let endIdx = lines.length
  for (let i = modelsIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (/^[A-Za-z_]/.test(line)) {
      endIdx = i
      break
    }
  }

  const inserted = [
    ...lines.slice(0, endIdx),
    '',
    '  # Added by verdict onboarding:',
    ...newBlocks.map(b => b.text),
    '',
    ...lines.slice(endIdx),
  ]
  return inserted.join('\n')
}

interface ModelBlock {
  id: string
  text: string
}

function collectModelIds(yamlText: string): Set<string> {
  const ids = new Set<string>()
  const re = /^\s*-\s*id:\s*([^\s#]+)/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(yamlText)) !== null) {
    if (m[1]) ids.add(m[1])
  }
  return ids
}

/**
 * Extract individual `  - id: ... ` model blocks from a rendered YAML. Each
 * block runs from its `- id:` line up to the next `- id:` line OR the next
 * top-level section.
 */
function extractModelBlocks(yamlText: string): ModelBlock[] {
  const lines = yamlText.split('\n')
  const blocks: ModelBlock[] = []
  let current: { id: string; text: string[] } | null = null
  let inModelsSection = false
  for (const line of lines) {
    if (/^models:\s*$/.test(line)) {
      inModelsSection = true
      continue
    }
    if (!inModelsSection) continue
    // Leave the section on next top-level key.
    if (/^[A-Za-z_]/.test(line)) {
      if (current) blocks.push({ id: current.id, text: current.text.join('\n') })
      current = null
      break
    }
    const idMatch = line.match(/^\s*-\s*id:\s*([^\s#]+)/)
    if (idMatch) {
      if (current) blocks.push({ id: current.id, text: current.text.join('\n') })
      current = { id: idMatch[1]!, text: [line] }
    } else if (current) {
      current.text.push(line)
    }
  }
  if (current) blocks.push({ id: current.id, text: current.text.join('\n') })
  return blocks
}

// ─── Unified diff ───────────────────────────────────────────────────────────

/**
 * Minimal unified diff producer. Good enough for a UI preview — not optimal
 * for storage. Uses an LCS-based algorithm to keep matching lines stable.
 */
export function unifiedDiff(a: string, b: string, label = 'file'): string {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const lcs = computeLcs(aLines, bLines)
  const ops = backtrack(aLines, bLines, lcs)

  const out: string[] = [`--- ${label} (current)`, `+++ ${label} (proposed)`]
  for (const op of ops) {
    if (op.kind === 'eq') out.push(' ' + op.line)
    else if (op.kind === 'del') out.push('-' + op.line)
    else out.push('+' + op.line)
  }
  return out.join('\n')
}

function computeLcs(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i]![j] = dp[i - 1]![j - 1]! + 1
      else dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
    }
  }
  return dp
}

type DiffOp = { kind: 'eq' | 'del' | 'add'; line: string }

function backtrack(a: string[], b: string[], dp: number[][]): DiffOp[] {
  const ops: DiffOp[] = []
  let i = a.length, j = b.length
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.unshift({ kind: 'eq', line: a[i - 1]! })
      i--
      j--
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      ops.unshift({ kind: 'del', line: a[i - 1]! })
      i--
    } else {
      ops.unshift({ kind: 'add', line: b[j - 1]! })
      j--
    }
  }
  while (i > 0) {
    ops.unshift({ kind: 'del', line: a[i - 1]! })
    i--
  }
  while (j > 0) {
    ops.unshift({ kind: 'add', line: b[j - 1]! })
    j--
  }
  return ops
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeRead(p: string): string {
  try {
    return fs.readFileSync(p, 'utf-8')
  } catch {
    return ''
  }
}
