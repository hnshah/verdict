/**
 * Workflow-template scaffolding for `verdict init --template <name>`.
 *
 * Each template ships a `verdict.yaml` + a single eval-pack as static yaml
 * files under `src/templates/<name>/`. At build time tsup mirrors those into
 * `dist/templates/`. At runtime we resolve the bundled path and copy the
 * pair into the user's cwd.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export interface TemplateSpec {
  name: string
  description: string
  evalPackFile: string   // filename to write inside eval-packs/
}

export const TEMPLATES: TemplateSpec[] = [
  {
    name: 'rag',
    description: 'Retrieval-Augmented Generation — faithfulness + relevance',
    evalPackFile: 'rag.yaml',
  },
  {
    name: 'agent',
    description: 'Tool-using agent — tool selection + planning quality',
    evalPackFile: 'agent.yaml',
  },
  {
    name: 'support',
    description: 'Customer support — tone + factuality + safety',
    evalPackFile: 'support.yaml',
  },
]

export function findTemplate(name: string): TemplateSpec | null {
  const n = name.toLowerCase().trim()
  return TEMPLATES.find(t => t.name === n) ?? null
}

export function listTemplateNames(): string[] {
  return TEMPLATES.map(t => t.name)
}

/**
 * Locate the bundled templates directory. Works in both:
 *   dev:   running tsx against src/    → src/templates/
 *   prod:  running dist/cli/index.js   → dist/templates/
 */
export function templatesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(here, 'templates'),                       // dist/cli/templates (unlikely)
    path.join(here, '..', 'templates'),                 // dist/templates
    path.join(here, '..', '..', 'templates'),
    path.join(here, '..', '..', 'src', 'templates'),    // dev mode
    path.join(here, '..', '..', '..', 'src', 'templates'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  // Last resort: throw a clear error at the call site
  return candidates[0]
}

export interface TemplateFiles {
  verdictYaml: string
  evalPackYaml: string
}

export function loadTemplate(name: string): TemplateFiles {
  const spec = findTemplate(name)
  if (!spec) {
    throw new Error(
      `Unknown template: ${name}. Available: ${listTemplateNames().join(', ')}`
    )
  }
  const dir = path.join(templatesDir(), spec.name)
  const verdictPath = path.join(dir, 'verdict.yaml')
  const packPath = path.join(dir, 'eval-pack.yaml')
  if (!fs.existsSync(verdictPath) || !fs.existsSync(packPath)) {
    throw new Error(
      `Template assets missing for "${name}". Looked under ${dir}. ` +
      `Reinstall verdict or run \`npm run build\` if you're developing locally.`
    )
  }
  return {
    verdictYaml: fs.readFileSync(verdictPath, 'utf-8'),
    evalPackYaml: fs.readFileSync(packPath, 'utf-8'),
  }
}
