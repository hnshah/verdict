import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { EventEmitter } from 'events'

import { installOllama, writeCloudKey } from '../install/ollama.js'

/**
 * Tiny fake `spawn` returning a ChildProcess-shaped EventEmitter. The
 * lifecycle is driven by the test: emit data → emit close. We only need
 * what `runProcess` actually consumes (stdout/stderr/.on(close)/.on(error)).
 */
function fakeChild(opts: {
  stdoutChunks?: string[]
  stderrChunks?: string[]
  exitCode?: number
  delayMs?: number
  emitError?: Error
}): { spawnFn: (cmd: string, args: string[]) => any; calls: Array<{ cmd: string; args: string[] }> } {
  const calls: Array<{ cmd: string; args: string[] }> = []
  const spawnFn = (cmd: string, args: string[]) => {
    calls.push({ cmd, args })
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
      kill: (sig?: NodeJS.Signals) => boolean
      pid: number
      unref?: () => void
    }
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.kill = () => true
    child.pid = 4242
    child.unref = () => undefined

    const fire = () => {
      for (const chunk of opts.stdoutChunks ?? []) {
        child.stdout.emit('data', Buffer.from(chunk))
      }
      for (const chunk of opts.stderrChunks ?? []) {
        child.stderr.emit('data', Buffer.from(chunk))
      }
      if (opts.emitError) {
        child.emit('error', opts.emitError)
      } else {
        child.emit('close', opts.exitCode ?? 0, null)
      }
    }
    if (opts.delayMs) setTimeout(fire, opts.delayMs)
    else queueMicrotask(fire)
    return child
  }
  return { spawnFn: spawnFn as unknown as (cmd: string, args: string[]) => any, calls }
}

describe('installOllama', () => {
  it('runs `brew install ollama` and streams stdout lines', async () => {
    const { spawnFn, calls } = fakeChild({
      stdoutChunks: ['==> Downloading\n', '==> Pouring\n'],
      exitCode: 0,
    })
    const lines: string[] = []
    const step = installOllama({ method: 'brew', spawnFn: spawnFn as any })
    await step.run({
      onLine: l => lines.push(l),
      signal: new AbortController().signal,
    })
    expect(calls[0]?.cmd).toBe('brew')
    expect(calls[0]?.args).toEqual(['install', 'ollama'])
    expect(lines).toContain('==> Downloading')
    expect(lines).toContain('==> Pouring')
  })

  it('runs the curl|sh fallback when method=curl', async () => {
    const { spawnFn, calls } = fakeChild({ exitCode: 0 })
    const step = installOllama({ method: 'curl', spawnFn: spawnFn as any })
    await step.run({ onLine: () => undefined, signal: new AbortController().signal })
    expect(calls[0]?.cmd).toBe('sh')
    expect(calls[0]?.args.join(' ')).toContain('curl -fsSL https://ollama.com/install.sh | sh')
  })

  it('throws an InstallStepFailure when brew exits non-zero', async () => {
    const { spawnFn } = fakeChild({
      stderrChunks: ['Error: tap failed\n'],
      exitCode: 1,
    })
    const step = installOllama({ method: 'brew', spawnFn: spawnFn as any })
    await expect(
      step.run({ onLine: () => undefined, signal: new AbortController().signal })
    ).rejects.toThrow(/exited with code 1/)
  })
})

describe('writeCloudKey', () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-key-'))
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('creates .env when missing', () => {
    const { wrote, envPath } = writeCloudKey({
      rootDir: tmp,
      envVar: 'OPENROUTER_API_KEY',
      value: 'sk-test',
    })
    expect(wrote).toBe(true)
    expect(envPath).toBe(path.join(tmp, '.env'))
    expect(fs.readFileSync(envPath, 'utf-8')).toContain('OPENROUTER_API_KEY=sk-test')
  })

  it('appends a new key to an existing .env', () => {
    const envPath = path.join(tmp, '.env')
    fs.writeFileSync(envPath, 'OTHER=value\n')
    const { wrote } = writeCloudKey({
      rootDir: tmp,
      envVar: 'OPENROUTER_API_KEY',
      value: 'sk-test',
    })
    expect(wrote).toBe(true)
    const text = fs.readFileSync(envPath, 'utf-8')
    expect(text).toContain('OTHER=value')
    expect(text).toContain('OPENROUTER_API_KEY=sk-test')
  })

  it('is idempotent: existing same key is preserved (not overwritten)', () => {
    const envPath = path.join(tmp, '.env')
    fs.writeFileSync(envPath, 'OPENROUTER_API_KEY=existing-key\n')
    const { wrote } = writeCloudKey({
      rootDir: tmp,
      envVar: 'OPENROUTER_API_KEY',
      value: 'new-key',
    })
    expect(wrote).toBe(false)
    expect(fs.readFileSync(envPath, 'utf-8')).toContain('OPENROUTER_API_KEY=existing-key')
  })
})
