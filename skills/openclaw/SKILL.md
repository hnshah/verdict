---
generated_at: "2026-03-29T21:30:00Z"
patched_at: "2026-03-29T21:30:00Z"
commit_sha: "cb2e31e7a9a0d89d1f8ef25ae9c13a5a51386ba6"
patch_count: 10
corpus_score_before: "88% (220/250)"
corpus_score_projected: "98% (245/250)"
---

# verdict Expert Skill

> LLM eval framework. Benchmark local and cloud models with one YAML config file.

## Architecture (Key Facts)

- **Language/Stack:** TypeScript (ESM), Node 18+, built with tsup. ~9,700 LOC across 53 files.
- **Dual entry:** CLI (`verdict run|init|models|history|route|serve|validate|compare|baseline|daemon|watch`) and programmatic library (`import { runEvals, loadConfig } from 'verdict'`).
- **Single provider path:** ALL model providers use OpenAI-compatible HTTP (`POST /v1/chat/completions`) via `src/providers/compat.ts`. No per-provider adapters. Supports Ollama, MLX, LM Studio, OpenRouter, Groq, OpenAI, etc.
- **Config:** `verdict.yaml` (Zod-validated) defines models, judge, packs, run settings, output formats. Supports `${ENV_VAR:-default}` interpolation.
  - ⚠️ `${UNSET_VAR}` (without `:-default` suffix) resolves to empty string `""` before Zod validation. For `api_key` this becomes `""` which passes string validation but fails at the provider. Always use `${VAR:-default}` syntax for fallbacks.
  - **Model config fields:** Each model in the `models` array supports: `id` (required), `model` (required — the provider's model name), `provider` (optional shortcut), `base_url`, `api_key`, `timeout_ms`, `max_tokens`, `port` (for local providers), `cost_per_1m_input`, `cost_per_1m_output`, `host`.
- **Eval packs:** YAML files in `eval-packs/` define cases. Each case has `prompt`, `criteria`, `scorer`, optional `expected`. Packs can reference JSONL files via `samples_file` for large-scale evals.
  - **JSONL case fields:** Each line is a JSON object with optional fields: `id`, `prompt`, `expected`, `scorer`, `criteria`, `tags`, `category`, `system_prompt`. Fields not specified on a JSONL line inherit from the pack-level defaults (`scorer`, `criteria` from the parent YAML). ⚠️ Gotcha: if the pack sets `scorer: exact` at the top level, all JSONL cases without their own `scorer` field inherit `exact`, leading to mass failures when LLM output doesn't exactly match expected text.
- **Scoring:** 10 deterministic scorers (`json`, `exact`, `contains`, `fuzzy_match`, `regex`, `jsonschema`, `tool_call`, `multiple_choice`, `javascript`) + LLM judge. All return `JudgeScore` on 0-10 scale. ⚠️ `javascript` scorer executes arbitrary code via `new Function()` — only use in trusted eval packs, never with untrusted user input. Cases using the javascript scorer specify code via the `scorer_code` field in the eval case YAML. `scoreMultipleChoice` tiers: exact letter match → 10, correct letter found within extra text → 8, wrong/no letter → 0.
  - **exact scorer:** Trims and lowercases both output and expected before comparison. A response of `" Paris "` matches expected `"paris"`.
  - **jsonschema scorer:** Validates JSON output against a provided schema. Deducts points per schema violation (graduated, not binary). Requires `schema` field in eval case.
- **LLM judge:** Calls judge model to score accuracy/completeness/conciseness (0-10 each). Total = weighted average using rubric weights (default: accuracy=0.4, completeness=0.4, conciseness=0.2). If the judge returns NaN or non-numeric values, the clamp function defaults to 5. Judge calls use `temperature: 0.0` for deterministic scoring.
- **Multi-assertion:** Cases can have `assertions: [{scorer, expected}]`. Aggregated using MIN (all must pass).
- **Persistence:** SQLite at `~/.verdict/results.db` via better-sqlite3. Tables: eval_results, question_results, models_registry, jobs, watched_models.
- **Reporters:** Terminal (chalk), Markdown, JSON, Slack card.
- **Router:** Classifies prompts by category, selects best model from eval history (via SQLite queries).
- **Checkpoint/Resume:** After each case completes (all models scored), saves `.verdict-checkpoint.json` in the output directory. On `--resume`, skips completed cases by matching case_id. Checkpoint includes full `partialResults` array and `completedCaseIds` set — these must stay in sync or summary rebuild fails. Checkpoint is deleted on successful run completion. **Config hash** = {model IDs, judge model, pack paths}; changing concurrency, retries, or rubric weights does NOT invalidate checkpoint. Changing models, judge, or packs DOES invalidate it (stale checkpoint ignored). Case IDs must be globally unique across packs since checkpoint tracks completion by case_id.
- **Baseline/Regression:** Save named baselines, compare runs, `--fail-if-regression` exits code 1 if any model drops >0.5pts.
- **Synthesis:** Optional LLM analysis of run results via `--question`, returns CLEAR/LEAN/INCONCLUSIVE verdict.
- **Retry behavior:** Provider HTTP errors are retried up to 2 times with exponential backoff (1s, 2s delays). On final failure, returns a `ModelResponse` with `error` field set (does not throw). The runner scores error responses as 0/10 with the error message as reasoning.
- **Rate limiting:** No explicit client-side rate limiting built in. Relies on provider-side rate limits + retry backoff for throttling.

### Module Map (abbreviated)

| Module | Purpose | Key File |
|--------|---------|----------|
| types | Zod schemas + interfaces | `src/types/index.ts` |
| core/config | Load YAML config + eval packs + JSONL | `src/core/config.ts` |
| core/runner | Main eval loop: cases × models → score → checkpoint | `src/core/runner.ts` |
| core/synthesis | Post-run LLM analysis | `src/core/synthesis.ts` |
| core/baseline | Save/load/compare baselines | `src/core/baseline.ts` |
| judge/deterministic | 10 deterministic scorers + dispatcher | `src/judge/deterministic.ts` |
| judge/llm | LLM-as-judge | `src/judge/llm.ts` |
| providers/compat | Universal OpenAI-compat client (callModel, callModelMultiTurn, callModelWithTools, pingModel) | `src/providers/compat.ts` |
| reporter/* | Terminal + Markdown output | `src/reporter/` |
| db | SQLite persistence | `src/db/client.ts`, `src/db/schema.ts` |
| router | Prompt classification + model selection | `src/router/` |
| daemon | Background job runner (eval queue, model watcher, IPC) | `src/daemon/` |
| cli | Commander CLI with 13+ commands | `src/cli/` |

### Serve, Daemon, and Watch

- **`verdict serve`:** Starts an HTTP server exposing verdict functionality (eval runs, routing) over a REST API. Uses the router module for prompt classification and model selection.
- **`verdict daemon`:** Background job runner. Processes queued eval jobs from the `jobs` SQLite table, watches for new local models (tracked in `watched_models` table), communicates via IPC. Unlike `serve`, daemon runs without an HTTP interface.
- **`verdict watch`:** Watches for new local models (e.g., newly pulled Ollama models) and registers them. Related to daemon's watcher functionality but runs as a standalone command.
- **Daemon module:** `src/daemon/` — depends on db, core/*. Manages eval queue, model watcher, and IPC communication.
- **Router DSPy shadow mode:** Optional mode where the router runs a DSPy-based classifier in parallel with the primary classifier for comparison/evaluation purposes.

### Data Flow
```
verdict.yaml → loadConfig() → Config (Zod-validated)
eval-packs/*.yaml → loadEvalPack() → EvalPack[] (Zod-validated, JSONL merged)
                         ↓
                  runEvals(config, packs)
                         ↓
            For each case × each model:
              callModel() → ModelResponse
              score() → JudgeScore
              checkpoint after each case
                         ↓
                  RunResult { cases[], summary{} }
                         ↓
            ├── Terminal report
            ├── Markdown report
            ├── JSON file
            ├── SQLite persistence
            └── Synthesis (optional)
```

## Hotkeys

**build:** `npm run build` (tsup)
**test:** `npm test` (vitest run)
**test-single:** `npx vitest run src/path/__tests__/file.test.ts`
**lint:** `npm run typecheck` (tsc --noEmit, no separate linter)
**run-eval:** `npx tsx src/cli/index.ts run`
**run-eval-with-model:** `npx tsx src/cli/index.ts run -m model-id-1,model-id-2`
**add-scorer:** edit `src/judge/deterministic.ts` + `src/types/index.ts` ScorerEnum + `isDeterministic()` + `scoreDeterministic()`
**debug-score:** `npx tsx src/cli/index.ts run --debug --verbose` (logs requests to stderr)
**config-location:** `./verdict.yaml` (project root, customizable with `-c`)
**db-location:** `~/.verdict/results.db` (SQLite, global)
**history:** `verdict history` — queries `~/.verdict/results.db`, shows run timestamps, model scores, and pack names from the `eval_results` and `question_results` tables.

## Top 5 Gotchas

### 1. Judge model must exist in the models array
`runEvals` looks up `config.judge.model` by ID in `config.models`. If missing: throws, run aborts. To use a cloud judge with only local contestants, add the judge to `models:` but use `--models` flag to exclude it from being a contestant.

### 2. tsup shims:false and external:['openai', 'better-sqlite3'] are load-bearing
`shims: true` injects a fetch polyfill that conflicts with openai SDK's undici client → Ollama calls hang forever. Bundling `openai` inline breaks HTTP handling. Never change these in `tsup.config.ts`.

### 3. tool_call scorer checks tool_calls not text — empty expected_tool means "expect no call"
If a model returns text instead of tool calls for `scorer: tool_call`, it's scored 0/10 ("no content"). If `expected_tool: ""`, the scorer returns 10/10 when no tool calls are made (intentional for testing tool refusal).

`scoreToolCall` graduated point breakdown (`src/judge/deterministic.ts`):
- No tool calls when expected: **0**
- Wrong tool name: **2** (attempted but wrong)
- Correct tool, no expected args: **6** (4 for correct name + 2 for valid format)
- Correct tool, some args right: **8** (6 + 2 per correct arg, capped at 4 arg points total)
- Perfect match: **10**

### 4. Multi-assertion aggregation uses MIN, not average
One failing assertion (0/10) pulls the entire case score to 0/10. Design assertions as hard requirements that must all pass.

### 5. Deterministic scorers must be registered in THREE places
A new scorer needs: (a) `ScorerEnum` in `src/types/index.ts`, (b) `isDeterministic()` in `src/judge/deterministic.ts`, (c) `scoreDeterministic()` dispatcher. Missing any one causes silent failure — the runner falls through to LLM judge or returns null.

## Top 3 Contribution Patterns

### Pattern 1: Add a New Deterministic Scorer

**Files to modify:**

1. `src/types/index.ts` — Add name to `ScorerEnum` and to `EvalPackSchema.scorer` enum
2. `src/judge/deterministic.ts` — Implement function, add to `isDeterministic()` and `scoreDeterministic()`
3. `src/core/runner.ts` — Only if non-standard params (like tool_call's special logic)
4. `src/index.ts` — Export the new function
5. `src/judge/__tests__/deterministic.test.ts` — Tests
6. `eval-packs/` — Example eval pack

**Function template:**
```ts
export function scoreNewScorer(output: string, expected: string): JudgeScore {
  const got = output.trim().toLowerCase()
  const want = expected.trim().toLowerCase()
  if (/* pass */) {
    return { accuracy: 10, completeness: 10, conciseness: 10, total: 10, reasoning: 'Pass.' }
  }
  return { accuracy: 0, completeness: 0, conciseness: 0, total: 0,
    reasoning: `Fail: expected "${want.slice(0, 40)}", got "${got.slice(0, 40)}"` }
}
```

**Register:**
```ts
// isDeterministic():
return scorer === 'json' || ... || scorer === 'new_scorer'

// scoreDeterministic():
if (scorer === 'new_scorer') return scoreNewScorer(output, expectedStr)
```

### Pattern 2: Add a New Model Provider (with shortcut)

**Files to modify:**
1. `src/types/index.ts` — Add to `ModelConfigSchema.provider` enum
2. `src/core/config.ts` — Add normalization case in `normalizeModels()`
3. `src/utils/model-config.ts` — Add case in `buildModelConfig()`
4. `src/db/client.ts` — Add heuristic in `detectProvider()`

**Normalization template (in config.ts):**
```ts
if (m.provider === 'your_provider') {
  return { ...m, base_url: `http://localhost:${port}/v1`, api_key: 'none' }
}
```

For providers that already speak OpenAI-compat (Groq, OpenRouter, Together, etc.): **no code changes needed**, just set `base_url` and `api_key` in verdict.yaml.

### Pattern 3: Add a New Reporter Format

**Files to modify:**
1. `src/reporter/your_format.ts` — New file implementing `generateYourReport(result: RunResult): string`
2. `src/types/index.ts` — Add to `ConfigSchema.output.formats` enum
3. `src/cli/commands/run.ts` — Wire output in the file-writing section (~line 223)
4. `src/index.ts` — Export for programmatic API

**Template:**
```ts
import type { RunResult } from '../types/index.js'
export function generateYourReport(result: RunResult): string {
  const sorted = result.models.map(id => result.summary[id]).filter(Boolean).sort((a, b) => b.avg_total - a.avg_total)
  // ... format output
  return formatted
}
```

## Invariants (Complete List)

1. **All scores are 0-10.** Every scorer returns JudgeScore.total in [0, 10]. LLM judge clamps. JavaScript scorer clamps. Summary averages assume this range.
2. **JudgeScore has 5 fields:** accuracy, completeness, conciseness, total, reasoning. All code paths must set all 5.
3. **Judge model ID must exist in config.models.** No fallback; throws if missing.
4. **Every model needs a resolvable base_url.** Either set directly or via provider shortcut normalization.
5. **Deterministic scorers registered in THREE places:** ScorerEnum, isDeterministic(), scoreDeterministic(). Missing any causes silent failure.
6. **Checkpoint partialResults must match completedCaseIds.** Divergence causes summary rebuild errors.
7. **Config hash = {model IDs, judge model, pack paths}.** Changing concurrency/retries/rubric does NOT invalidate checkpoint.
8. **OpenAI clients cached by base_url+api_key.** Shared clients mean first-creator's timeout wins.
9. **Multi-assertion MIN aggregation.** One zero kills the score.
10. **Case IDs should be globally unique across packs.** Checkpoint uses case_id for completion tracking.
11. **Regression threshold = 0.5 points (hardcoded).** Not configurable via config or CLI.
12. **SQLite DB is global (~/.verdict/results.db).** Not per-project. Use --no-store to skip.

## Testing

- **Framework:** vitest with `globals: true`
- **Location:** `src/**/__tests__/*.test.ts` (14 test files)
- **Run all:** `npm test`
- **Run one:** `npx vitest run src/judge/__tests__/deterministic.test.ts`
- **Coverage:** `npm run test:coverage`
- **Convention:** Unit tests only, no external API calls. Deterministic scorers are tested directly. Provider functions are mocked.

## Key Dependencies

| Package | Role |
|---------|------|
| openai | Universal HTTP client for OpenAI-compat endpoints |
| better-sqlite3 | SQLite persistence (sync API) |
| zod | Config + eval pack schema validation |
| js-yaml | YAML parsing |
| commander | CLI framework |
| chalk | Terminal coloring |
| ora | CLI spinners |
| tsup | Bundler (ESM, dual entry: CLI + library) |
| vitest | Test runner |
