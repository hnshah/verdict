# verdict compiled build fix — compiled binary hangs on Ollama

## What was broken

`node dist/cli/index.js run` hung indefinitely when making API calls to Ollama.
`npx tsx src/cli/index.ts run` worked fine.
`--dry-run` worked fine (no API calls made).

## Root cause

`tsup` was bundling the `openai` SDK inline into the compiled output. When bundled, the SDK loses access to its internal `undici` HTTP client. Calls to Ollama (or any local inference server) silently hang — no error, no timeout, no output.

The `shims: true` option was also injecting a `fetch` polyfill that conflicted with the openai SDK's own HTTP handling.

## Fix

Two changes to `tsup.config.ts`:

```diff
export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
- target: 'node20',
+ target: 'node22',
  outDir: 'dist/cli',
  clean: true,
- shims: true,
+ // shims: false — do not inject fetch polyfill, conflicts with openai SDK internals
+ shims: false,
+ // external: ['openai'] — load from node_modules at runtime, not bundled inline
+ external: ['openai'],
  banner: {
    js: '#!/usr/bin/env node',
  },
})
```

That's it. Rebuild and the compiled binary works.

```bash
npm run build
node dist/cli/index.js run   # works
```

## Why this works

Marking `openai` as `external` means tsup emits `import OpenAI from "openai"` in the bundle and Node.js resolves it from `node_modules` at runtime. The full SDK loads correctly with `undici` intact. HTTP connections to Ollama work as expected.

Since `openai` is already in `dependencies` (not `devDependencies`), it's always present when the package is installed — no runtime dependency change needed.

## Affected versions

Any version of verdict built with tsup and `openai` as a direct dependency, when running against local inference servers (Ollama, MLX, LM Studio). Cloud providers (OpenRouter, OpenAI direct) may have been affected too but are harder to reproduce since their connections typically error vs. hang.
