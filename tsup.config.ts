import { defineConfig } from 'tsup'

export default defineConfig({
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
  external: ['openai', 'better-sqlite3'],
  banner: {
    js: '#!/usr/bin/env node',
  },
})
