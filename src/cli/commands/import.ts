import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import yaml from 'js-yaml'

// ─── HuggingFace API types ────────────────────────────────────────────────────

interface HFSplitsResponse {
  splits: Array<{ dataset: string; config: string; split: string }>
}

interface HFRowsResponse {
  rows: Array<{ row_idx: number; row: Record<string, unknown> }>
  num_rows_total?: number
}

// ─── Field detection ──────────────────────────────────────────────────────────

/**
 * Common field name patterns across popular HuggingFace datasets.
 * Priority order matters — first match wins.
 */
const INPUT_FIELD_CANDIDATES = [
  'question', 'prompt', 'input', 'instruction', 'query', 'text',
  'premise', 'sentence', 'context', 'problem',
]

const OUTPUT_FIELD_CANDIDATES = [
  'answer', 'output', 'completion', 'response', 'label', 'solution',
  'target', 'gold', 'hypothesis', 'choices',
]

export function detectFields(row: Record<string, unknown>): {
  inputField: string | null
  outputField: string | null
} {
  const keys = Object.keys(row)

  const inputField = INPUT_FIELD_CANDIDATES.find(f => keys.includes(f)) ?? null
  const outputField = OUTPUT_FIELD_CANDIDATES.find(f => keys.includes(f)) ?? null

  return { inputField, outputField }
}

/**
 * Extract the final numeric answer from GSM8K-style "#### 18" answers.
 * Returns the clean expected value (just the number) or the full text if no marker.
 */
function extractExpected(raw: unknown): string {
  if (typeof raw !== 'string') return String(raw)
  const markerMatch = raw.match(/####\s*(.+)$/)
  if (markerMatch) return markerMatch[1].trim()
  return raw.trim()
}

// ─── HuggingFace API helpers ──────────────────────────────────────────────────

const HF_API_BASE = 'https://datasets-server.huggingface.co'

async function fetchJSON<T>(url: string): Promise<T> {
  const resp = await fetch(url)
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`HuggingFace API error ${resp.status}: ${body.slice(0, 200)}`)
  }
  return resp.json() as Promise<T>
}

/**
 * Get available splits for a dataset. Returns the first config's splits
 * (most datasets have a single 'main' config).
 */
async function fetchSplits(dataset: string): Promise<Array<{ config: string; split: string }>> {
  const url = `${HF_API_BASE}/splits?dataset=${encodeURIComponent(dataset)}`
  const data = await fetchJSON<HFSplitsResponse>(url)
  return data.splits.map(s => ({ config: s.config, split: s.split }))
}

/**
 * Fetch rows from the HuggingFace Datasets Server API.
 * Handles pagination for datasets that require --max > 100.
 */
async function fetchRows(
  dataset: string,
  config: string,
  split: string,
  max: number,
): Promise<Array<Record<string, unknown>>> {
  const PAGE_SIZE = 100
  const rows: Array<Record<string, unknown>> = []
  let offset = 0

  while (rows.length < max) {
    const batchSize = Math.min(PAGE_SIZE, max - rows.length)
    const url = `${HF_API_BASE}/rows?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${batchSize}`
    const data = await fetchJSON<HFRowsResponse>(url)

    if (!data.rows || data.rows.length === 0) break
    rows.push(...data.rows.map(r => r.row))
    offset += data.rows.length

    // If we got fewer rows than requested, we've hit the end
    if (data.rows.length < batchSize) break
  }

  return rows
}

// ─── Import command ───────────────────────────────────────────────────────────

export interface ImportOptions {
  hf?: string
  split?: string
  config?: string   // HF dataset config (e.g., 'main', 'socratic')
  max?: number
  output?: string
  inputField?: string
  outputField?: string
  criteria?: string
  scorer?: string
  dryRun?: boolean
}

export async function importCommand(opts: ImportOptions): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' import'))
  console.log()

  if (!opts.hf) {
    console.error(chalk.red('  ✗ --hf <dataset-name> is required'))
    console.log()
    console.log('  ' + chalk.dim('Example:'))
    console.log(`    ${chalk.cyan('verdict import --hf openai/gsm8k --split test --max 50 --output eval-packs/gsm8k.yaml')}`)
    process.exit(1)
  }

  const max = opts.max ?? 100
  const split = opts.split ?? 'test'
  const outputPath = opts.output
    ? path.resolve(opts.output)
    : path.resolve(`eval-packs/${opts.hf.replace('/', '-')}-${split}.yaml`)

  // ── 1. Discover configs ───────────────────────────────────────────────────
  const spinner = ora(`  Discovering dataset splits for ${chalk.bold(opts.hf)}…`).start()
  let splits: Array<{ config: string; split: string }> = []

  try {
    splits = await fetchSplits(opts.hf)
    spinner.succeed(`  Found ${splits.length} split(s)`)
  } catch (err) {
    spinner.fail(`  Failed to fetch dataset info`)
    console.error(chalk.red(`  ✗ ${(err as Error).message}`))
    console.log()
    console.log(chalk.dim('  Is this dataset public and available via the HuggingFace Datasets Server?'))
    console.log(chalk.dim('  Check: https://datasets-server.huggingface.co/splits?dataset=' + encodeURIComponent(opts.hf)))
    process.exit(1)
  }

  // Pick config: prefer user-supplied, then 'main', then first available
  let hfConfig = opts.config
  if (!hfConfig) {
    const mainConfig = splits.find(s => s.config === 'main')
    hfConfig = mainConfig?.config ?? splits[0]?.config
  }
  if (!hfConfig) {
    console.error(chalk.red('  ✗ No configs found for this dataset'))
    process.exit(1)
  }

  // Validate split exists in chosen config
  const validSplits = splits.filter(s => s.config === hfConfig).map(s => s.split)
  if (!validSplits.includes(split)) {
    console.error(chalk.red(`  ✗ Split '${split}' not found in config '${hfConfig}'`))
    console.log(chalk.dim(`  Available splits: ${validSplits.join(', ')}`))
    process.exit(1)
  }

  console.log(chalk.dim(`  Config: ${hfConfig} | Split: ${split} | Max: ${max}`))
  console.log()

  // ── 2. Fetch rows ─────────────────────────────────────────────────────────
  const fetchSpinner = ora(`  Fetching up to ${max} rows…`).start()
  let rawRows: Array<Record<string, unknown>> = []

  try {
    rawRows = await fetchRows(opts.hf, hfConfig, split, max)
    fetchSpinner.succeed(`  Fetched ${rawRows.length} rows`)
  } catch (err) {
    fetchSpinner.fail('  Failed to fetch rows')
    console.error(chalk.red(`  ✗ ${(err as Error).message}`))
    process.exit(1)
  }

  if (rawRows.length === 0) {
    console.error(chalk.red('  ✗ No rows returned from HuggingFace API'))
    process.exit(1)
  }

  // ── 3. Detect fields ──────────────────────────────────────────────────────
  const sampleRow = rawRows[0]
  const detected = detectFields(sampleRow)

  const inputField = opts.inputField ?? detected.inputField
  const outputField = opts.outputField ?? detected.outputField

  console.log()
  console.log('  ' + chalk.bold('Field mapping'))
  if (inputField) {
    console.log(`  ${chalk.green('✓')} Input field:  ${chalk.cyan(inputField)}`)
  } else {
    console.log(`  ${chalk.yellow('⚠')} Input field:  ${chalk.yellow('not detected')} — use --input-field to specify`)
  }
  if (outputField) {
    console.log(`  ${chalk.green('✓')} Output field: ${chalk.cyan(outputField)}`)
  } else {
    console.log(`  ${chalk.dim('–')} Output field: ${chalk.dim('not detected')} — evals will use LLM judge only`)
  }
  console.log()
  console.log('  ' + chalk.dim('Available fields: ' + Object.keys(sampleRow).join(', ')))

  if (!inputField) {
    console.error(chalk.red('\n  ✗ Cannot determine input field. Use --input-field <name> to specify.'))
    process.exit(1)
  }

  // ── 4. Convert rows to eval cases ─────────────────────────────────────────
  const datasetShortName = opts.hf.split('/').pop() ?? opts.hf
  const defaultCriteria = opts.criteria
    ?? `Accurate, correct response to the question. Judge on factual correctness and completeness.`
  const scorer = opts.scorer ?? (outputField ? 'llm' : 'llm')

  interface EvalCaseYaml {
    id: string
    prompt: string
    criteria: string
    expected?: string
    scorer: string
    tags: string[]
  }

  const cases: EvalCaseYaml[] = rawRows.map((row, idx) => {
    const prompt = String(row[inputField] ?? '').trim()
    const rawExpected = outputField ? row[outputField] : undefined
    const expected = rawExpected !== undefined ? extractExpected(rawExpected) : undefined

    const c: EvalCaseYaml = {
      id: `${datasetShortName}-${split}-${String(idx + 1).padStart(4, '0')}`,
      prompt,
      criteria: defaultCriteria,
      scorer,
      tags: [`source:huggingface`, `dataset:${opts.hf}`, `split:${split}`],
    }
    if (expected !== undefined) {
      c.expected = expected
    }
    return c
  })

  // ── 5. Preview (dry run or sample) ────────────────────────────────────────
  console.log('  ' + chalk.bold('Sample case'))
  const sample = cases[0]
  console.log(chalk.dim('  id:       ') + sample.id)
  console.log(chalk.dim('  prompt:   ') + sample.prompt.slice(0, 80) + (sample.prompt.length > 80 ? '…' : ''))
  if (sample.expected) {
    console.log(chalk.dim('  expected: ') + sample.expected.slice(0, 60) + (sample.expected.length > 60 ? '…' : ''))
  }
  console.log(chalk.dim('  scorer:   ') + sample.scorer)
  console.log()

  if (opts.dryRun) {
    console.log(chalk.yellow('  Dry run — no file written.'))
    console.log(chalk.dim(`  Would write ${cases.length} cases to: ${outputPath}`))
    process.exit(0)
  }

  // ── 6. Write YAML ─────────────────────────────────────────────────────────
  const packName = `${opts.hf} (${split}, ${cases.length} cases)`
  const pack = {
    name: packName,
    version: '1.0.0',
    description: `Imported from HuggingFace: ${opts.hf} — ${split} split, ${cases.length} cases. Auto-generated by verdict import.`,
    cases,
  }

  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, yaml.dump(pack, { lineWidth: 120, noRefs: true }), 'utf8')

  console.log(chalk.green(`  ✓ Written ${cases.length} cases → ${outputPath}`))
  console.log()
  console.log('  ' + chalk.bold('Next steps'))
  console.log(`    ${chalk.cyan('verdict validate ' + path.relative(process.cwd(), outputPath))}`)
  console.log(`    ${chalk.cyan('verdict run --pack ' + path.relative(process.cwd(), outputPath))}`)
  console.log()
}
