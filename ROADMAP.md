# Verdict Roadmap: Production-Grade Audit

> Audit date: 2026-03-28
> Auditor: Senior Engineering Lead
> Compared against: promptfoo, Braintrust, EleutherAI lm-evaluation-harness

---

## Executive Summary

Verdict is an ambitious LLM eval framework at v0.2.0 with a strong value proposition: **answer "which model should I use?" with one config file.** The core eval loop (run models, judge, leaderboard) works. The architecture is clean TypeScript with Zod schemas, and the test suite passes 111 tests across 7 files.

**However, verdict has not yet crossed the threshold from "promising prototype" to "tool people trust."**

The critical gaps are:
1. **No programmatic API / SDK** — you can only use verdict via CLI, not import it
2. **Test coverage is shallow** — the runner, providers, reporters, CLI commands, and router have zero tests
3. **README examples are aspirational, not real** — the output blocks are hand-typed mock output, not actual terminal captures
4. **Error messages are generic** — most `catch` blocks just print `err.message`, no suggestions
5. **Eval pack format lacks key features** — no `regex`, no `javascript` custom scorer, no `system_prompt` field, no multi-assertion per case
6. **Missing validation at boundaries** — running `verdict run` with a wrong pack path or missing judge model gives cryptic crashes

The project has a strong foundation and clear vision. This roadmap turns it into something people will confidently `npm install -g`.

---

## Area Scores (1-10)

| Area | Score | Summary |
|------|-------|---------|
| README quality | 6/10 | Good structure, but examples are fabricated output, placeholder URLs, no install-and-go demo |
| Code architecture | 7/10 | Clean separation (core/providers/judge/reporter/cli), Zod schemas, but no programmatic API, duplicated OpenAI client construction |
| Test coverage | 4/10 | Deterministic scorers, DB, selector well-tested; runner, providers, config, CLI, reporter, router untested |
| CLI UX | 6/10 | Intuitive command structure, good spinners/chalk output, but missing `--help` examples, `--verbose`, `--json` output mode |
| Eval pack format | 5/10 | Covers basics (llm/json/exact/contains/jsonschema/tool_call), but no regex, no custom JS/Python scorer, no system prompt, no multi-assertion, no weight per case |
| Documentation | 5/10 | 4 doc files exist but incomplete; no API docs, no architecture diagram, writing-eval-packs.md mentions `--tags` filter as "not yet implemented" |
| Error handling | 4/10 | Config errors have decent Zod messages, but provider errors just surface raw OpenAI SDK messages; no "did you mean?" suggestions |
| Performance | 6/10 | Concurrency-chunked execution works, but no streaming, no progress ETA, no result caching across runs, OpenAI client re-created per call |

---

## Quick Wins (1-2 days each, highest impact)

### QW-1: Replace fabricated README output with actual terminal recordings

**Problem:** Every output block in README.md (`verdict run`, leaderboard, cost-quality frontier) is hand-typed. The fake `$0.00` cost, `8.7/10` scores, and invented model names undermine trust. Placeholder URLs (`https://github.com/yourusername/verdict`, `https://discord.gg/verdict`, `https://verdict.dev`) are still in the README.

**Action:**
- Run `verdict run --dry-run` and capture real output with `asciinema` or `terminalizer`
- Add a 60-second GIF showing: `verdict init` → `verdict models discover` → `verdict run --pack general` → leaderboard
- Replace all `yourusername` URLs with `hnshah`
- Remove links to non-existent resources (Discord, verdict.dev)

**Impact:** First thing every potential user sees. Fabricated output = immediate distrust.

### QW-2: Add `--json` output flag to `verdict run`

**Problem:** No machine-readable output from CLI. CI/CD pipelines need JSON, not chalk-colored terminal output.

**Action:**
- Add `--json` flag to `run` command
- When set, suppress all `console.log`/chalk output and print the `RunResult` JSON to stdout
- Add `--quiet` flag that suppresses spinner/progress but still prints summary

**Impact:** Unblocks CI/CD use case and programmatic consumption. promptfoo outputs to JSON/CSV/HTML/YAML.

### QW-3: Add `--fail-if-regression` exit code support

**Problem:** README advertises `verdict run --baseline production --fail-if-regression` but this flag doesn't exist in the CLI definition.

**Action:**
- Add `--baseline <name>` option to `run` command
- Add `--fail-threshold <delta>` option (default: 0.5)
- Exit with code 1 if any model regresses beyond threshold vs baseline
- Document in README CI/CD section with working example

**Impact:** Makes the CI/CD regression-detection story actually work.

### QW-4: Create a `verdict validate` command

**Problem:** No way to check if `verdict.yaml` and eval packs are valid without running an eval. `verdict run` with a malformed config gives a wall of Zod errors.

**Action:**
- New `verdict validate` command that parses config + packs and reports issues
- Human-friendly error messages: "In verdict.yaml, models[0] is missing required field 'model'. Did you mean to add 'model: qwen2.5:7b'?"
- Check that judge model ID exists in models list
- Check that pack paths exist

**Impact:** Dramatically improves first-run experience. promptfoo has `promptfoo validate`.

### QW-5: Reuse OpenAI client instances

**Problem:** `callModel()`, `callModelMultiTurn()`, and `callModelWithTools()` each create a new `OpenAI()` client per invocation. For 25 cases x 3 models x 1 judge = 100+ client instantiations.

**Action:**
- Create a `getClient(config: ModelConfig): OpenAI` function with a `Map<string, OpenAI>` cache keyed on `base_url + api_key`
- Use it in all three `call*` functions and in `judgeResponse()`

**Impact:** Reduces memory churn and connection overhead. Clean architectural win.

---

## Medium Term (1-2 weeks each)

### MT-1: Add comprehensive test coverage for core modules

**Current state:** 111 tests across 7 files. But the most critical paths are untested:

| Module | Tests? | What needs testing |
|--------|--------|-------------------|
| `core/runner.ts` | None | runEvals with mock providers, checkpoint resume, category filter, error cases |
| `core/config.ts` | None | env var substitution, provider normalization, malformed YAML, missing fields |
| `core/baseline.ts` | None | save/load/compare, regression detection thresholds |
| `core/synthesis.ts` | None | JSON parsing fallback, verdict classification logic |
| `providers/compat.ts` | None | retry logic, vision fallback, cost calculation, timeout handling |
| `providers/ollama.ts` | None | discovery with mock HTTP, MoE detection patterns |
| `providers/mlx.ts` | None | port scanning, model ID parsing |
| `judge/llm.ts` | None | prompt construction, JSON parsing, score clamping |
| `reporter/terminal.ts` | None | cost-quality frontier logic, medal display |
| `reporter/markdown.ts` | None | table generation, baseline comparison section |
| `cli/commands/run.ts` | None | flag parsing, error paths, dry-run output |
| `router/classifier.ts` | None | classification accuracy per category |

**Target:** 80%+ line coverage on `core/`, `providers/`, `judge/`, `reporter/`. Use `vitest` with mocked HTTP and mocked OpenAI client.

### MT-2: Add `system_prompt` field to eval cases

**Problem:** Cases only have `prompt` (user message). No way to test system prompts, which is the most common LLM customization.

**Action:**
- Add optional `system_prompt: string` to `EvalCaseSchema`
- Pass it as the first message in `callModel()` when present
- Add example eval pack `eval-packs/system-prompt-testing.yaml`

### MT-3: Add `regex` and `javascript` scorers

**Problem:** Verdict has 6 scorers (llm, json, exact, contains, jsonschema, tool_call). promptfoo has 30+. The biggest gaps:

| Scorer | Use Case | Priority |
|--------|----------|----------|
| `regex` | Pattern matching (emails, dates, structured formats) | High |
| `javascript` | Custom scoring function (`file://score.js` or inline) | High |
| `similar` | Embedding-based semantic similarity | Medium |
| `starts-with` | Output must begin with X | Low |
| `cost` | Assert cost < threshold | Low |
| `latency` | Assert latency < threshold | Low |

**Action:**
- Add `regex` scorer: case scores 10/10 if output matches regex, 0/10 otherwise
- Add `javascript` scorer: user provides a function `(output, expected, context) => { score: number, reasoning: string }`
- Update `writing-eval-packs.md` with scorer comparison table

### MT-4: Export a programmatic API

**Problem:** verdict is CLI-only. No `import { runEvals } from 'verdict'`. Can't be used as a library in CI scripts, custom tools, or other frameworks.

**Action:**
- Add `src/index.ts` that exports: `runEvals`, `loadConfig`, `loadEvalPack`, `judgeResponse`, `scoreDeterministic`, `VerdictRouter`
- Add `"exports"` field to `package.json` pointing to `dist/index.js`
- Update tsup to build both CLI and library entry points
- Add a `docs/programmatic-api.md` with usage examples

### MT-5: Add multi-assertion support per case

**Problem:** Each case has exactly one scorer. promptfoo supports an `assert` array where you can combine assertions: "output must be valid JSON AND contain the key 'result' AND score > 0.8 on LLM rubric."

**Action:**
- Add optional `assertions: Array<{ scorer, expected?, threshold? }>` to `EvalCaseSchema`
- When present, run all assertions and aggregate (pass = all pass, score = average)
- Backward-compatible: single `scorer` field still works as today

### MT-6: Add `--verbose` and `--debug` flags

**Problem:** When something fails silently (model timeout, judge parse error), there's no way to see what happened without reading source code.

**Action:**
- `--verbose`: Show full model responses, judge prompts/responses, timing per case
- `--debug`: Show HTTP request/response bodies, retry attempts, checkpoint writes
- Use a lightweight logger (or just `process.env.VERDICT_DEBUG`) rather than adding a logging dependency

### MT-7: Deduplicate `buildModelConfig` function

**Problem:** The `buildModelConfig()` function is copy-pasted identically in `src/daemon/index.ts:37-75` and `src/cli/commands/serve.ts:25-63`. Both construct ModelConfig from a model ID and provider string.

**Action:**
- Extract to `src/providers/config-builder.ts`
- Import in both locations
- Add tests

---

## Long Term (Strategic, multi-week)

### LT-1: Web UI dashboard

**Problem:** Results are JSON files and terminal output. No way to visually explore results, compare runs over time, or share with non-technical stakeholders.

**Action:**
- Lightweight local web server (`verdict serve --ui`)
- Show: run history, model leaderboard over time, per-case drill-down, cost trends
- Stack: vanilla HTML + CSS + Chart.js (no React/framework dependency)
- Read from SQLite DB (`~/.verdict/results.db`)

promptfoo has `promptfoo view` which launches a full React app.

### LT-2: GitHub Action for CI/CD regression detection

**Action:**
- Official `hnshah/verdict-action` GitHub Action
- Inputs: config path, baseline name, fail threshold
- Runs `verdict run --baseline <name> --fail-if-regression --json`
- Posts a summary comment on PR with leaderboard diff
- Exit code 1 on regression

### LT-3: Plugin system for custom providers and scorers

**Problem:** Adding a new provider or scorer requires modifying verdict source code. Should be pluggable.

**Action:**
- Define `VerdictPlugin` interface: `{ providers?: Provider[], scorers?: Scorer[] }`
- Support `plugins: ["./my-plugin.js"]` in `verdict.yaml`
- Plugins are ES modules exporting a `register()` function

### LT-4: Prompt optimization loop

**Action:**
- `verdict optimize --pack my-pack` runs evals, identifies lowest-scoring cases, uses an LLM to suggest prompt improvements
- Iterative: run → analyze → suggest → re-run
- Output: improved eval pack with suggested prompt modifications

### LT-5: Dataset generation from production logs

**Action:**
- `verdict generate --from logs.jsonl` creates eval cases from real prompt/response pairs
- Clusters similar prompts, deduplicates, generates criteria from responses
- Outputs a new eval pack YAML

---

## Specific GitHub Issues to Open

### Critical (open immediately)

**Issue #1: "README contains placeholder URLs and fabricated output"**
> The README links to `https://github.com/yourusername/verdict`, `https://discord.gg/verdict`, and `https://verdict.dev` which don't exist. All terminal output blocks show hand-typed examples rather than actual tool output. This is the first thing potential users see.
>
> Action items:
> - [ ] Replace `yourusername` with `hnshah` in all URLs
> - [ ] Remove links to non-existent Discord and docs site
> - [ ] Record real terminal output with asciinema or equivalent
> - [ ] Add a GIF demo showing `verdict init` → `verdict run` → leaderboard

**Issue #2: "Add `--json` output flag for CI/CD consumption"**
> `verdict run` only outputs chalk-colored terminal text. CI/CD pipelines and scripts need structured JSON output. Add `--json` flag that suppresses all human-readable output and prints the `RunResult` JSON to stdout.

**Issue #3: "Implement `--fail-if-regression` flag advertised in README"**
> The README FAQ section shows `verdict run --baseline production --fail-if-regression` as a CI/CD example, but neither `--baseline` nor `--fail-if-regression` exist as CLI options. The `run` command should accept these flags and exit with code 1 when regression is detected.

**Issue #4: "Add `verdict validate` command for config checking"**
> No way to validate `verdict.yaml` and eval pack YAML files without running a full eval. A `verdict validate` command should parse config, check model references, verify pack paths, and report human-friendly errors.

### High Priority

**Issue #5: "Test coverage: core modules have 0% coverage"**
> The test suite covers deterministic scorers, DB schema, DB client, selector, history, and daemon (111 tests). But `core/runner.ts`, `core/config.ts`, `providers/compat.ts`, `judge/llm.ts`, `reporter/terminal.ts`, and all CLI commands have zero test coverage.
>
> Target: 80% line coverage on `core/`, `providers/`, `judge/`, `reporter/`.

**Issue #6: "Add `system_prompt` field to eval cases"**
> Eval cases only support `prompt` (user message). There's no way to test different system prompts, which is the most common LLM customization pattern. Add an optional `system_prompt` field to `EvalCaseSchema` and pass it as the first message.

**Issue #7: "Add `regex` scorer for pattern matching"**
> The deterministic scorers cover `json`, `exact`, `contains`, `jsonschema`, and `tool_call`. Missing: `regex` for pattern matching (validate email format, date format, specific output structure). This is a trivial addition with high utility.

**Issue #8: "Add `javascript` custom scorer"**
> Users need custom scoring logic (e.g., "check that the output is valid Python by running `python -c`"). Add a `javascript` scorer that accepts a file path or inline function: `scorer: javascript`, `scoreFn: "file://score.js"`.

**Issue #9: "Export programmatic API (library mode)"**
> Verdict is CLI-only. There's no way to `import { runEvals } from 'verdict'`. Add an `src/index.ts` entry point exporting core functions and update `package.json` exports.

### Medium Priority

**Issue #10: "Deduplicate `buildModelConfig` (copy-pasted in 2 files)"**
> `buildModelConfig()` is identically implemented in `src/daemon/index.ts:37-75` and `src/cli/commands/serve.ts:25-63`. Extract to a shared module.

**Issue #11: "Add `--verbose` / `--debug` logging flags"**
> When evals fail silently (model timeout, judge parse error), users have no visibility. Add `--verbose` for human-readable detail and `--debug` for raw HTTP traces.

**Issue #12: "CONTRIBUTING.md references non-existent scripts and patterns"**
> CONTRIBUTING.md references `npm run lint`, `npm run format`, `npm run test:integration`, and a `BaseProvider` class that don't exist. The provider example uses a class-based pattern (`LMStudioProvider extends BaseProvider`) that doesn't match the actual functional architecture. Update to reflect reality.

**Issue #13: "Add multi-assertion support per eval case"**
> Each case supports exactly one scorer. Add an `assertions` array so a single case can require: "valid JSON AND contains key 'result' AND LLM rubric score > 7."

**Issue #14: "Reuse OpenAI client instances instead of creating per-call"**
> `callModel()`, `callModelMultiTurn()`, `callModelWithTools()`, and `judgeResponse()` each instantiate `new OpenAI()`. For a 25-case run with 3 models + judge = 100+ instances. Cache by `base_url + api_key`.

**Issue #15: "Router `classifier.ts` has dead code (4 unused private methods)"**
> `TaskClassifier` has private methods `keywordSignal()`, `structureSignal()`, `verbSignal()`, `lengthSignal()`, `aggregateSignals()`, and `simpleClassify()` that are never called. The `classify()` method reimplements the logic inline. Delete the dead methods or refactor to use them.

**Issue #16: "DSPy router has command injection vulnerability"**
> `dspy-router.ts:48` passes user input directly into a shell command: `const command = \`${this.pythonPath} ${this.scriptPath} ${JSON.stringify(prompt)}\``. The `JSON.stringify()` doesn't prevent shell injection if the prompt contains backticks or `$()`. Use `execFile()` with argument array instead of `exec()` with string concatenation.

**Issue #17: "Add `version` field to `verdict.yaml` config schema"**
> The config has no version field, making it impossible to handle breaking schema changes in the future. Add `version: 1` to `ConfigSchema` with validation.

**Issue #18: "`tsup.config.ts` targets `node22` but `package.json` says `>=18`"**
> `tsup.config.ts` sets `target: 'node22'` but `package.json` declares `"engines": { "node": ">=18" }`. Either bump the engine requirement to Node 22 or lower the tsup target.

---

## Architecture Notes for Contributors

### What's Good

- **Clean Zod schemas** — `types/index.ts` is the single source of truth for all data shapes
- **Provider abstraction** — everything goes through OpenAI-compat API, works for 6+ backends
- **Checkpoint/resume** — `runner.ts` saves progress after each case, handles crash recovery
- **Cost-quality frontier** — unique feature that immediately answers "should I pay for cloud?"
- **Blind judging** — judge never sees model names, reducing bias

### What Needs Attention

- **No dependency injection** — provider, judge, and reporter are hardcoded in runner. Should accept interfaces for testability
- **Synchronous file I/O** — `fs.readFileSync` / `fs.writeFileSync` throughout. Fine for CLI, blocks event loop for daemon/serve
- **Two separate SQLite schemas** — `db/schema.ts` for eval results and `router/storage.ts` for router data. Should be unified or at least share the connection
- **`any` types in router** — `storage.ts` uses `as any` extensively. Type the row interfaces properly
- **Dead CONTRIBUTING.md examples** — provider example shows class-based architecture (`BaseProvider`) that doesn't exist in the actual codebase

---

## Competitive Intelligence (Research Findings)

### vs. promptfoo (v0.121.3, 30k+ GitHub stars)

**What promptfoo does better:**
- **30+ assertion types** (vs verdict's 6 scorers): `contains`, `equals`, `is-json`, `regex`, `similar` (embedding), `javascript`, `python`, `llm-rubric`, `factuality`, `answer-relevancy`, `cost`, `latency`, and more
- **Imperative YAML config** with `prompts`, `providers`, `tests`, and `assert` arrays — each test case can have multiple assertions with weights
- **`promptfoo validate`** command for config checking before running
- **Multi-output**: `--output csv,json,yaml,html` with `--share` for shareable URLs
- **Extension hooks**: `beforeAll`, `afterAll`, `beforeEach`, `afterEach` lifecycle hooks for custom JS/Python
- **Filtering**: `--filter-pattern`, `--filter-providers`, `--filter-metadata`, `--filter-sample` — granular test selection
- **Provider architecture**: class-based `ApiProvider` interface with Template Method pattern; cascading credential resolution (config > env var > default)
- **Error handling**: structured error objects with HTTP metadata (`{ error, metadata: { http: { status, headers } } }`), cache invalidation on failures, graceful degradation for tool callbacks
- **Build tooling**: Biome + Prettier for linting/formatting, pnpm workspaces, integration + smoke tests
- **Documentation**: 20+ practical guides covering RAG evaluation, hallucination prevention, model comparisons, framework integrations (LangChain, CrewAI, LangGraph)

**What verdict does better:**
- **Local-first cost-quality analysis** — tracks `total_cost_usd` per model per run, surfaces cost delta in terminal. Promptfoo has cost assertions but no frontier analysis
- **Decision synthesis** — after a run, an LLM synthesizes CLEAR/LEAN/INCONCLUSIVE verdict with key findings. Promptfoo has no equivalent
- **Checkpoint/resume** — saves `.verdict-checkpoint.json` after every case, `verdict run --resume` restarts mid-run. Promptfoo relies on disk caching
- **Multi-turn native in YAML** — `__model__` sentinel in `turns` array. Promptfoo requires sessionParser hooks
- **Tool-calling native in YAML** — `tools` array with `expected_tool` and `expected_args` per case. Promptfoo handles this through custom assertion functions

### vs. Braintrust

**What Braintrust does better:**
- **Cloud experiment tracking** — every run creates an experiment with side-by-side diff views, regression highlighting, historical trends
- **Production-to-eval pipeline** — production logs convert directly into eval datasets
- **autoevals library** — ~20+ pre-built scorers including RAG-specific (`ContextPrecision`, `Faithfulness`, `AnswerRelevancy`), embedding similarity, and fine-tuned binary classifiers
- **Multi-language SDKs** — Python, TypeScript, Go, Ruby, C# (verdict is TypeScript-only)
- **Human-in-the-loop scoring** — supports human scoring alongside automated scoring in same experiment
- **`Battle` scorer** — head-to-head model comparison within a single scorer call
- **AI-assisted prompt optimization** ("Loop") that closes the eval → improve loop

**What verdict does better:**
- **No cloud required** — runs fully offline with local models. Braintrust requires their cloud for experiment tracking
- **YAML-driven eval packs** — declarative config vs Braintrust's imperative TypeScript/Python code
- **SQLite persistence** — results stored locally at `~/.verdict/results.db`, queryable with `verdict history`
- **Smart routing** — built-in model router that learns from eval history. No equivalent in Braintrust

### vs. EleutherAI lm-evaluation-harness

**What lm-eval does better:**
- **100+ academic benchmarks** — MMLU, HellaSwag, TruthfulQA, GSM8K, etc. All pre-built with standardized YAML format
- **HuggingFace dataset integration** — `dataset_path` directly references HF datasets
- **Output types** — `generate_until`, `loglikelihood`, `multiple_choice` — supports perplexity-based evaluation
- **Backend coverage** — HuggingFace, vLLM, SGLang, NeMo, OpenVINO, GPT-NeoX
- **Jinja2 templates** — `doc_to_text`, `doc_to_target`, `doc_to_choice` for flexible data transformation
- **Post-processing pipelines** — `filter_list` with majority voting, answer extraction

**What verdict does better:**
- **Task-custom eval design** — write your own eval cases for your specific use case vs. fixed academic benchmarks
- **Real-world model comparison** — focuses on practical "which model for my workload" vs. academic leaderboard scores
- **Conversational eval** — multi-turn and tool-calling support. lm-eval is single-turn completion oriented
- **Lightweight** — `npm install -g verdict` vs. complex Python environment setup with optional extras

### Scorer Comparison Table

| Scorer Type | verdict | promptfoo | Braintrust | lm-eval |
|-------------|---------|-----------|------------|---------|
| Exact match | `exact` | `equals` | `ExactMatch` | `exact_match` |
| Contains | `contains` | `contains` | - | - |
| JSON validity | `json` | `is-json` | `JSONValidity` | - |
| JSON schema | `jsonschema` | `is-valid-json-schema` | - | - |
| Regex | - | `regex` | - | - |
| Custom code | - | `javascript`, `python` | custom scorer fn | `!function` |
| LLM judge | `llm` | `llm-rubric` | `Factuality` etc. | - |
| Embedding similarity | - | `similar` | `EmbeddingSimilarity` | - |
| Tool call | `tool_call` | custom assertion | custom scorer | - |
| RAG metrics | - | - | 8 RAG scorers | - |
| Cost/latency | - | `cost`, `latency` | - | - |
| Levenshtein | - | `levenshtein` | `Levenshtein` | - |
| **Total** | **6** | **30+** | **20+** | **5-10** |

---

*This roadmap was generated by a comprehensive audit of every source file, test, doc, eval pack, and config in the verdict repository, benchmarked against promptfoo (v0.121.3, 30k+ GitHub stars), Braintrust, and EleutherAI lm-evaluation-harness.*
