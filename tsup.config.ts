import { defineConfig } from 'tsup'
import fs from 'fs'
import path from 'path'

/**
 * Mirror `src/serve/ui-static/**` into `dist/serve/ui-static/**` so the
 * dashboard HTML/CSS/JSX assets ship with the built bundle. Runs after
 * the CLI build completes.
 */
function copyUiStatic(): void {
  const src = path.resolve('src/serve/ui-static')
  const dst = path.resolve('dist/serve/ui-static')
  if (!fs.existsSync(src)) return
  fs.rmSync(dst, { recursive: true, force: true })
  fs.cpSync(src, dst, { recursive: true })
}

export default defineConfig([
  // CLI bundle — executable with shebang
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    target: 'node18',
    outDir: 'dist/cli',
    clean: true,
    // Do NOT use shims:true — it injects a fetch polyfill that conflicts with
    // the openai SDK's internal undici HTTP client and causes Ollama calls to hang.
    shims: false,
    // Mark openai as external so it loads from node_modules at runtime rather
    // than being bundled inline. Bundling the openai SDK breaks its HTTP handling.
    external: ['openai', 'better-sqlite3', 'react', 'react/jsx-runtime', 'ink', '@inkjs/ui', '@ink-tools/ink-mouse'],
    banner: {
      js: '#!/usr/bin/env node',
    },
    onSuccess: async () => {
      copyUiStatic()
    },
  },
  // Library bundle — programmatic API for `import { runEvals } from '@hnshah/verdict'`
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    clean: false,
    dts: true,
    shims: false,
    external: ['openai', 'better-sqlite3', 'react', 'react/jsx-runtime', 'ink', '@inkjs/ui', '@ink-tools/ink-mouse'],
  },
])
