import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { runSmokeEval } from '../verify.js'

describe('runSmokeEval', () => {
  it('returns a structured failure when verdict.yaml does not exist', async () => {
    const result = await runSmokeEval({
      configPath: '/definitely/not/a/real/path/verdict.yaml',
      timeoutMs: 1000,
    })
    expect(result.ok).toBe(false)
    expect(result.failures.length).toBeGreaterThan(0)
    expect(result.failures[0]?.step).toBe('load-config')
  })

  it('returns a structured failure when no candidate model exists', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-verify-'))
    try {
      // Config where the only model is also the judge — no separate candidate.
      const cfg = `version: "1.0"
name: only-judge
models:
  - id: solo
    base_url: "http://localhost:99999/v1"
    model: solo
judge:
  model: solo
packs:
  - ./eval-packs/general.yaml
`
      const cfgPath = path.join(tmp, 'verdict.yaml')
      fs.writeFileSync(cfgPath, cfg)
      // The smoke runner picks the first non-judge or falls back to the first
      // model. Either way the model endpoint is unreachable, so it'll fail at
      // the model-call step. We just want a structured failure, not a throw.
      const result = await runSmokeEval({ configPath: cfgPath, timeoutMs: 3000 })
      expect(result.ok).toBe(false)
      // Either timed-out or model-call failed — both are acceptable for this
      // smoke check.
      expect(result.failures.length).toBeGreaterThan(0)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }, 15000)
})
