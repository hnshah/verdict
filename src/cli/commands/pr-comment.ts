/**
 * verdict pr-comment <result.json> — emit GitHub PR comment markdown.
 *
 * Reads a verdict result JSON and writes a compact, sticky PR-comment
 * markdown blob to stdout. Designed to be piped to `gh pr comment` from
 * the verdict GitHub Action.
 */

import fs from 'fs'
import path from 'path'
import { generatePrCommentMarkdown } from '../../reporter/markdown.js'
import type { RunResult } from '../../types/index.js'

export async function prCommentCommand(resultPath: string): Promise<void> {
  const resolved = path.resolve(resultPath)
  if (!fs.existsSync(resolved)) {
    console.error(`pr-comment: result file not found: ${resultPath}`)
    process.exit(1)
  }
  let result: RunResult
  try {
    result = JSON.parse(fs.readFileSync(resolved, 'utf-8'))
  } catch (err) {
    console.error(`pr-comment: failed to parse ${resultPath}: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
  process.stdout.write(generatePrCommentMarkdown(result) + '\n')
}
