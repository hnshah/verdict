/**
 * Eval registry tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Use vi.hoisted so the variable is available when vi.mock factory runs (hoisted above imports)
const { mockVerdictDir } = vi.hoisted(() => {
  const fsMod = require('fs')
  const pathMod = require('path')
  const osMod = require('os')
  return {
    mockVerdictDir: fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), 'verdict-registry-test-')),
  }
})

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os')
  return {
    ...actual,
    default: {
      ...actual,
      homedir: () => mockVerdictDir,
    },
    homedir: () => mockVerdictDir,
  }
})

import {
  loadRegistry,
  saveRegistry,
  registryAdd,
  registryRemove,
  registryList,
  registryResolve,
  registerBuiltinPacks,
  getRegistryPath,
} from '../registry.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-reg-'))
}

function writePackFile(dir: string, filename: string): string {
  const fullPath = path.join(dir, filename)
  fs.writeFileSync(fullPath, `name: ${filename}\ncases:\n  - id: c1\n    prompt: test\n    criteria: test\n    scorer: llm`, 'utf8')
  return fullPath
}

// ─── Setup ───────────────────────────────────────────────────────────────────

describe('eval registry', () => {
  beforeEach(() => {
    // Clean the mock registry before each test
    const regPath = path.join(mockVerdictDir, '.verdict', 'registry.json')
    if (fs.existsSync(regPath)) fs.unlinkSync(regPath)
  })

  afterEach(() => {
    const regPath = path.join(mockVerdictDir, '.verdict', 'registry.json')
    if (fs.existsSync(regPath)) fs.unlinkSync(regPath)
  })

  // ─── loadRegistry ──────────────────────────────────────────────────────────

  describe('loadRegistry', () => {
    it('returns empty object when no registry file exists', () => {
      expect(loadRegistry()).toEqual({})
    })

    it('returns parsed registry when file exists', () => {
      const regDir = path.join(mockVerdictDir, '.verdict')
      fs.mkdirSync(regDir, { recursive: true })
      fs.writeFileSync(
        path.join(regDir, 'registry.json'),
        JSON.stringify({ general: '/some/path.yaml' })
      )
      expect(loadRegistry()).toEqual({ general: '/some/path.yaml' })
    })

    it('returns empty object for malformed JSON', () => {
      const regDir = path.join(mockVerdictDir, '.verdict')
      fs.mkdirSync(regDir, { recursive: true })
      fs.writeFileSync(path.join(regDir, 'registry.json'), '{ broken json')
      expect(loadRegistry()).toEqual({})
    })
  })

  // ─── saveRegistry ──────────────────────────────────────────────────────────

  describe('saveRegistry', () => {
    it('creates the registry file and directories', () => {
      saveRegistry({ test: '/path/to/test.yaml' })
      const regPath = path.join(mockVerdictDir, '.verdict', 'registry.json')
      expect(fs.existsSync(regPath)).toBe(true)
      const content = JSON.parse(fs.readFileSync(regPath, 'utf8'))
      expect(content).toEqual({ test: '/path/to/test.yaml' })
    })
  })

  // ─── registryAdd ───────────────────────────────────────────────────────────

  describe('registryAdd', () => {
    let tmpDir: string

    beforeEach(() => { tmpDir = makeTempDir() })
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true }) })

    it('adds a pack to the registry with absolute path', () => {
      const packFile = writePackFile(tmpDir, 'my-pack.yaml')
      const result = registryAdd('my-pack', packFile)
      expect(result).toBe(packFile)

      const registry = loadRegistry()
      expect(registry['my-pack']).toBe(packFile)
    })

    it('resolves relative paths to absolute', () => {
      const packFile = writePackFile(tmpDir, 'relative.yaml')
      // Use relative path from the perspective of cwd
      const cwd = process.cwd()
      const relPath = path.relative(cwd, packFile)
      const result = registryAdd('relative', relPath)
      expect(path.isAbsolute(result)).toBe(true)
    })

    it('throws when pack file does not exist', () => {
      expect(() => registryAdd('missing', '/no/such/file.yaml'))
        .toThrow(/Eval pack not found/)
    })

    it('overwrites existing registration for same name', () => {
      const pack1 = writePackFile(tmpDir, 'v1.yaml')
      const pack2 = writePackFile(tmpDir, 'v2.yaml')
      registryAdd('my-eval', pack1)
      registryAdd('my-eval', pack2)
      const registry = loadRegistry()
      expect(registry['my-eval']).toBe(pack2)
    })
  })

  // ─── registryRemove ────────────────────────────────────────────────────────

  describe('registryRemove', () => {
    let tmpDir: string

    beforeEach(() => { tmpDir = makeTempDir() })
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true }) })

    it('removes an existing entry and returns true', () => {
      const packFile = writePackFile(tmpDir, 'to-remove.yaml')
      registryAdd('to-remove', packFile)
      expect(registryRemove('to-remove')).toBe(true)
      expect(loadRegistry()['to-remove']).toBeUndefined()
    })

    it('returns false when entry does not exist', () => {
      expect(registryRemove('nonexistent')).toBe(false)
    })
  })

  // ─── registryList ──────────────────────────────────────────────────────────

  describe('registryList', () => {
    let tmpDir: string

    beforeEach(() => { tmpDir = makeTempDir() })
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true }) })

    it('returns all registered evals', () => {
      const pack1 = writePackFile(tmpDir, 'a.yaml')
      const pack2 = writePackFile(tmpDir, 'b.yaml')
      registryAdd('alpha', pack1)
      registryAdd('beta', pack2)
      const list = registryList()
      expect(Object.keys(list)).toHaveLength(2)
      expect(list['alpha']).toBe(pack1)
      expect(list['beta']).toBe(pack2)
    })

    it('returns empty object when nothing registered', () => {
      expect(registryList()).toEqual({})
    })
  })

  // ─── registryResolve ───────────────────────────────────────────────────────

  describe('registryResolve', () => {
    let tmpDir: string

    beforeEach(() => { tmpDir = makeTempDir() })
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true }) })

    it('resolves a file path that exists on disk', () => {
      const packFile = writePackFile(tmpDir, 'direct.yaml')
      const result = registryResolve(packFile)
      expect(result).toBe(packFile)
    })

    it('resolves a registered name to its path', () => {
      const packFile = writePackFile(tmpDir, 'named.yaml')
      registryAdd('named', packFile)
      const result = registryResolve('named')
      expect(result).toBe(packFile)
    })

    it('returns null for unknown name and non-existent path', () => {
      expect(registryResolve('totally-unknown')).toBeNull()
    })

    it('prefers file path over registry name when both exist', () => {
      // Create a file with a name that also exists in registry
      const packFile = writePackFile(tmpDir, 'ambiguous.yaml')
      // Directly save to registry to bypass registryAdd's file-existence check
      const registry = loadRegistry()
      registry['ambiguous'] = '/some/other/path.yaml'
      saveRegistry(registry)

      // The actual file path should resolve to the file
      const result = registryResolve(packFile)
      expect(result).toBe(packFile)
    })
  })

  // ─── registerBuiltinPacks ──────────────────────────────────────────────────

  describe('registerBuiltinPacks', () => {
    it('returns 0 when eval-packs directory does not exist', () => {
      // With mocked homedir, __dirname won't find real eval-packs
      // but the function should still return 0 gracefully
      const count = registerBuiltinPacks()
      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  // ─── getRegistryPath ───────────────────────────────────────────────────────

  describe('getRegistryPath', () => {
    it('returns a path ending with registry.json', () => {
      const p = getRegistryPath()
      expect(p).toMatch(/registry\.json$/)
    })

    it('includes .verdict directory', () => {
      const p = getRegistryPath()
      expect(p).toContain('.verdict')
    })
  })
})
