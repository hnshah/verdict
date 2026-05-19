import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogCommand } from '../models.js'

describe('models catalog command', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints catalog fit data as JSON', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-catalog-'))
    const catalog = path.join(dir, 'model-catalog.yaml')
    fs.writeFileSync(catalog, [
      'version: "1.0"',
      'models:',
      '  - name: "tiny-test:1b"',
      '    provider: ollama',
      '    params_b: 1',
      '    default_quant: q4_K_M',
      '    family: test',
      '    tags: [test]',
      '',
    ].join('\n'))

    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      output += chunk.toString()
      return true
    })

    await catalogCommand({ catalog, json: true })

    const parsed = JSON.parse(output)
    expect(parsed.models).toHaveLength(1)
    expect(parsed.models[0].name).toBe('tiny-test:1b')
    expect(parsed.models[0].fit.needs_gb).toBe(0.6)
  })
})
