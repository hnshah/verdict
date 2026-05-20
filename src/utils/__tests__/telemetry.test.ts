import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

describe('telemetry', () => {
  let tmpHome: string
  let originalHome: string | undefined

  beforeEach(() => {
    originalHome = process.env['HOME']
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-tel-'))
    process.env['HOME'] = tmpHome
    delete process.env['VERDICT_TELEMETRY_URL']
    // Reset module cache so loadPrefs picks up the new HOME each time.
    vi.resetModules()
  })

  afterEach(() => {
    process.env['HOME'] = originalHome
    fs.rmSync(tmpHome, { recursive: true, force: true })
  })

  it('defaults to no prefs file (opt-out)', async () => {
    const tel = await import('../telemetry.js')
    expect(tel.loadPrefs()).toBeNull()
    expect(tel.statusLine()).toMatch(/not configured/)
  })

  it('enable creates a prefs file with a fresh install_id', async () => {
    const tel = await import('../telemetry.js')
    const prefs = tel.enable()
    expect(prefs.enabled).toBe(true)
    expect(prefs.install_id).toMatch(/^[0-9a-f-]{36}$/)
    const reread = tel.loadPrefs()
    expect(reread?.enabled).toBe(true)
    expect(reread?.install_id).toBe(prefs.install_id)
  })

  it('disable preserves install_id', async () => {
    const tel = await import('../telemetry.js')
    const before = tel.enable()
    const after = tel.disable()
    expect(after.enabled).toBe(false)
    expect(after.install_id).toBe(before.install_id)
  })

  it('ping does nothing when telemetry is off', async () => {
    const tel = await import('../telemetry.js')
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    tel.disable()
    tel.ping({ models_count: 3, packs_count: 1, verdict_version: '0.3.0' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('ping does nothing when VERDICT_TELEMETRY_URL is not set, even when enabled', async () => {
    const tel = await import('../telemetry.js')
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    tel.enable()
    tel.ping({ models_count: 3, packs_count: 1, verdict_version: '0.3.0' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('ping fires fetch when enabled and endpoint configured', async () => {
    process.env['VERDICT_TELEMETRY_URL'] = 'https://test.example/ping'
    const tel = await import('../telemetry.js')
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    tel.enable()
    tel.ping({ models_count: 3, packs_count: 2, verdict_version: '0.3.0' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://test.example/ping')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.models_count).toBe(3)
    expect(body.packs_count).toBe(2)
    expect(body.verdict_version).toBe('0.3.0')
    expect(body.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body.install_id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('ping never throws even when fetch rejects', async () => {
    process.env['VERDICT_TELEMETRY_URL'] = 'https://test.example/ping'
    const tel = await import('../telemetry.js')
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch
    tel.enable()
    // Should not throw; the rejection should be swallowed.
    expect(() => tel.ping({ models_count: 1, packs_count: 1, verdict_version: '0.3.0' })).not.toThrow()
  })

  it('payload never includes prompts, scores, or hostnames', async () => {
    process.env['VERDICT_TELEMETRY_URL'] = 'https://test.example/ping'
    const tel = await import('../telemetry.js')
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    tel.enable()
    tel.ping({ models_count: 2, packs_count: 1, verdict_version: '0.3.0' })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(Object.keys(body).sort()).toEqual(['day', 'install_id', 'models_count', 'packs_count', 'verdict_version'])
  })

  it('statusLine reflects on/off correctly', async () => {
    const tel = await import('../telemetry.js')
    expect(tel.statusLine()).toMatch(/not configured/)
    tel.enable()
    expect(tel.statusLine()).toMatch(/on, install_id=/)
    tel.disable()
    expect(tel.statusLine()).toMatch(/off/)
  })
})
