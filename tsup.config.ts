import { defineConfig } from 'tsup'

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
  },
  // Library bundle — programmatic API for `import { runEvals } from 'verdict'`
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
