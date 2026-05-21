# Programmatic API

Use Verdict as a library in your own scripts, CI pipelines, or custom tools.

## Installation

```bash
npm install @hnshah/verdict
```

## Quick Start (one-liner)

```ts
import { runEvalsFromConfig } from '@hnshah/verdict'

const result = await runEvalsFromConfig('./verdict.yaml', {
  onProgress: msg => console.log(msg),
})

console.log(`Run: ${result.run_id}`)
for (const [modelId, summary] of Object.entries(result.summary)) {
  console.log(`${modelId}: ${summary.avg_total.toFixed(2)}/10 — ${summary.cases_run} cases`)
}
```

`runEvalsFromConfig` loads the YAML, resolves eval packs relative to the
config's directory, and runs everything in one shot. Use it when the
config file is the source of truth.

### Options

```ts
type RunEvalsFromConfigOptions = {
  onProgress?: (msg: string) => void
  resume?: boolean           // resume from checkpoint
  categoryFilter?: string[]  // only run these case categories
  preload?: boolean          // default true; disable for cloud-only configs
  packs?: string[]           // override config.packs (paths relative to config dir)
}
```

### Embed in a Next.js / Express route

```ts
// app/api/eval/route.ts
import { runEvalsFromConfig } from '@hnshah/verdict'

export async function POST() {
  const result = await runEvalsFromConfig('./verdict.yaml', { preload: false })
  return Response.json({
    winner: result.summary[Object.keys(result.summary).sort(
      (a, b) => result.summary[b].avg_total - result.summary[a].avg_total
    )[0]],
  })
}
```

## Advanced: manual orchestration

When you need finer control (custom pack lists, mutated configs, in-memory
packs), call the three primitives directly:

```ts
import { loadConfig, loadEvalPack, runEvals } from '@hnshah/verdict'
import path from 'path'

const config = loadConfig('./verdict.yaml')
const configDir = path.dirname(path.resolve('./verdict.yaml'))
const packs = config.packs.map(p => loadEvalPack(p, configDir))

const result = await runEvals(config, packs, msg => console.log(msg))

console.log(`Run: ${result.run_id}`)
for (const [modelId, summary] of Object.entries(result.summary)) {
  console.log(`${modelId}: ${summary.avg_total}/10 (${summary.win_rate}% win rate)`)
}
```

## API Reference

### `loadConfig(configPath: string): VerdictConfig`

Load and validate a Verdict YAML config file. Resolves environment variables and provider shortcuts.

```ts
import { loadConfig } from '@hnshah/verdict'

const config = loadConfig('./verdict.config.yaml')
```

Throws if the file is missing or the config is invalid.

### `loadEvalPack(packPath: string, configDir: string): EvalPack`

Load and validate a YAML eval pack. `configDir` is used to resolve relative pack paths.

```ts
import { loadEvalPack } from '@hnshah/verdict'

const pack = loadEvalPack('./eval-packs/general.yaml', process.cwd())
```

### `runEvals(config, packs, onProgress?, resume?, categoryFilter?): Promise<EvalResult>`

Run evaluations across all models and eval packs.

```ts
import { loadConfig, loadEvalPack, runEvals } from '@hnshah/verdict'

const config = loadConfig('./verdict.config.yaml')
const packs = config.packs.map(p => loadEvalPack(p, '.'))

const result = await runEvals(
  config,
  packs,
  msg => console.log(msg),  // progress callback
  false,                      // resume from checkpoint
  ['reasoning']               // optional category filter
)
```

**Parameters:**
- `config` — Parsed config object from `loadConfig`
- `packs` — Array of eval packs from `loadEvalPack`
- `onProgress` — Optional callback for progress messages
- `resume` — Resume from checkpoint if available (default: `false`)
- `categoryFilter` — Only run cases matching these categories

**Returns:** `EvalResult` with `run_id`, `cases`, `summary`, and optional `synthesis`.

### `judgeResponse(judgeModel, config, prompt, criteria, response): Promise<JudgeScore>`

Score a single response using an LLM judge.

```ts
import { judgeResponse } from '@hnshah/verdict'

const score = await judgeResponse(
  judgeModel,   // ModelConfig for the judge
  judgeConfig,  // JudgeConfig with rubric weights
  'What is 2+2?',
  'Accuracy and clarity',
  'The answer is 4.'
)

console.log(`Score: ${score.total}/10 — ${score.reasoning}`)
```

### `scoreDeterministic(scorer, output, expected?, schema?, choices?): JudgeScore | null`

Score a response using deterministic (non-LLM) scorers.

```ts
import { scoreDeterministic } from '@hnshah/verdict'

// Exact match
scoreDeterministic('exact', 'Paris', 'Paris')       // { total: 10, ... }

// Contains substring
scoreDeterministic('contains', 'Hello world', 'world') // { total: 10, ... }

// Valid JSON
scoreDeterministic('json', '{"key": "value"}')      // { total: 10, ... }

// Regex match
scoreDeterministic('regex', 'abc123', '\\d+')        // { total: 10, ... }

// JSON schema validation
scoreDeterministic('jsonschema', '{"name": "test"}', undefined, {
  required: ['name'],
  properties: { name: { type: 'string' } }
})
```

**Supported scorers:** `json`, `exact`, `contains`, `fuzzy_match`, `regex`, `jsonschema`, `multiple_choice`

Returns `null` for unknown scorer types.

### `VerdictRouter`

Route prompts to the best model based on eval history.

```ts
import { VerdictRouter } from '@hnshah/verdict'

const router = new VerdictRouter('./verdict-router.db')
const { classification, choice } = await router.route('Explain quantum computing')

console.log(`Category: ${classification.category}`)
console.log(`Best model: ${choice.model} (${choice.reason})`)

router.close()
```

## Types

All types are exported for TypeScript users:

```ts
import type {
  VerdictConfig,
  EvalCase,
  EvalPack,
  ModelConfig,
  JudgeConfig,
  ModelResponse,
  JudgeScore,
  CaseResult,
  ModelSummary,
  EvalResult,
} from '@hnshah/verdict'
```
