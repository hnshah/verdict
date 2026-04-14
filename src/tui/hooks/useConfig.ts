/**
 * Load a verdict.yaml config (Zod-validated) for read-only display in the TUI.
 * Writing is Phase 2 (Config Editor screen).
 */

import { useEffect, useState } from 'react'
import fs from 'fs'
import path from 'path'
import { loadConfig } from '../../core/config.js'
import type { Config } from '../../types/index.js'

export function useConfig(configPath = './verdict.yaml') {
  const [config, setConfig] = useState<Config | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const abs = path.resolve(configPath)
      if (!fs.existsSync(abs)) {
        setError(`Config not found: ${abs}`)
        return
      }
      const cfg = loadConfig(abs)
      setConfig(cfg)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [configPath])

  return { config, error }
}
