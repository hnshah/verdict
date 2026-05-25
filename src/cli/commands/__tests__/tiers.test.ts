import { afterEach, describe, expect, it, vi } from 'vitest'
import { tiersShowCommand } from '../tiers.js'

describe('tiers show command', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps frontier pull commands out of the default pull guidance', () => {
    const lines: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.join(' '))
    })

    tiersShowCommand('24gb')

    const output = lines.join('\n')
    expect(output).toContain('ollama pull qwen3:14b')
    expect(output).not.toContain('ollama pull gemma3:27b')
    expect(output).not.toContain('ollama pull qwen3:32b')
    expect(output).toContain('verdict run --tier 24gb --frontier')
  })
})
