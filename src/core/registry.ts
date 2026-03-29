import fs from 'fs'
import path from 'path'
import os from 'os'

function getVerdictDir(): string {
  return path.join(os.homedir(), '.verdict')
}

function getRegistryFilePath(): string {
  return path.join(getVerdictDir(), 'registry.json')
}

export interface Registry {
  [name: string]: string // name → absolute file path
}

/** Read the registry file, returning an empty object if it doesn't exist. */
export function loadRegistry(): Registry {
  const registryPath = getRegistryFilePath()
  if (!fs.existsSync(registryPath)) return {}
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  } catch {
    return {}
  }
}

/** Persist the registry to disk. */
export function saveRegistry(registry: Registry): void {
  const verdictDir = getVerdictDir()
  fs.mkdirSync(verdictDir, { recursive: true })
  fs.writeFileSync(getRegistryFilePath(), JSON.stringify(registry, null, 2))
}

/** Register an eval pack under a name. Path is resolved to absolute. */
export function registryAdd(name: string, packPath: string): string {
  const abs = path.resolve(packPath)
  if (!fs.existsSync(abs)) {
    throw new Error(`Eval pack not found: ${abs}`)
  }
  const registry = loadRegistry()
  registry[name] = abs
  saveRegistry(registry)
  return abs
}

/** Remove a named eval from the registry. Returns true if it existed. */
export function registryRemove(name: string): boolean {
  const registry = loadRegistry()
  if (!(name in registry)) return false
  delete registry[name]
  saveRegistry(registry)
  return true
}

/** List all registered evals. */
export function registryList(): Registry {
  return loadRegistry()
}

/**
 * Resolve an eval name or path.
 * 1. If the value is a file path that exists, return it as-is.
 * 2. If it matches a registry name, return the registered path.
 * 3. Otherwise, return null.
 */
export function registryResolve(nameOrPath: string): string | null {
  // Check as file path first (absolute or relative)
  const asPath = path.resolve(nameOrPath)
  if (fs.existsSync(asPath)) return asPath

  // Check registry
  const registry = loadRegistry()
  if (nameOrPath in registry) {
    const registeredPath = registry[nameOrPath]
    if (fs.existsSync(registeredPath)) return registeredPath
  }

  return null
}

/**
 * Auto-register built-in eval packs from the package's eval-packs/ directory.
 * Skips packs that are already registered (does not overwrite user customizations).
 */
export function registerBuiltinPacks(): number {
  // Find the eval-packs directory relative to this source file
  // In dist: dist/core/registry.js → ../../eval-packs
  // In src: src/core/registry.ts → ../../eval-packs
  const evalPacksDir = path.resolve(__dirname, '..', '..', 'eval-packs')
  if (!fs.existsSync(evalPacksDir)) return 0

  const registry = loadRegistry()
  let added = 0

  const files = fs.readdirSync(evalPacksDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
  for (const file of files) {
    const name = file.replace(/\.ya?ml$/, '')
    if (!(name in registry)) {
      registry[name] = path.join(evalPacksDir, file)
      added++
    }
  }

  if (added > 0) saveRegistry(registry)
  return added
}

/** Get the path to the registry file (for display purposes). */
export function getRegistryPath(): string {
  return getRegistryFilePath()
}
