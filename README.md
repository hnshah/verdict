# Verdict

**Local and cloud model benchmarking that answers: which model should I use?**

```
verdict run

Models: qwen2.5:7b, llama3.2:3b, sonnet
Judge:  haiku
Cases:  25 across 3 packs

[1] qwen2.5:7b           ||||||||||  8.7  Fast, accurate, great for code
[2] claude-sonnet        |||||||||.  8.4  Best reasoning, 10x cost
[3] llama3.2:3b          |||||||...  7.1  Good for simple tasks

Winner: qwen2.5:7b (8.7/10, $0.00)

💡 Cost-quality frontier:
   qwen2.5:7b matches sonnet within 0.3pts for FREE
   → Use the local model, save $50/mo
```

---

## Why Verdict?

### The Problem

You're choosing between models based on:
- ❌ Generic benchmarks (MMLU, HellaSwag) that don't match your work
- ❌ Vibes and anecdotes ("Model X feels better")
- ❌ Expensive trial and error in production

### The Solution

**Verdict runs YOUR tasks against ANY models and tells you which wins.**

- ✅ Test local vs cloud on tasks that matter to you
- ✅ Catch quality regressions (2-bit quantization broke JSON? You'll know)
- ✅ Make data-driven decisions (not vibes)
- ✅ One config file, runs anywhere, zero cloud dependency

---

## Quick Start

### Install

```bash
npm install -g verdict
# or
npx verdict init
```

### Runtime notes

Verdict uses `better-sqlite3` for local history, routing, and daemon state.
That package has a native binding.

If you switch Node versions or install on a fresh machine and see an error like:

```text
Could not locate the bindings file ... better_sqlite3.node
```

run:

```bash
npm rebuild better-sqlite3
```

Then rerun:

```bash
npm run doctor
npm test
```

### Initialize

```bash
verdict init
```

Creates:
- `verdict.yaml` - Your config (models, judge, settings)
- `eval-packs/` - Test cases for your domain

### Discover Models

```bash
verdict models discover
```

Finds installed Ollama/MLX models, gives you YAML to paste into config.

### Run Evals

```bash
verdict run

# Run specific pack
verdict run --pack code-generation

# Test specific models
verdict run --models "qwen2.5:7b,sonnet"

# Filter cases by category
verdict run --category reasoning

# Dry run (preview without API calls)
verdict run --dry-run

# CI/CD mode (JSON output, fail on regression)
verdict run --json --fail-if-regression
```

---

## What You Get

### 1. Leaderboard

Which model won on your tasks?

```
[1] qwen2.5:7b           ||||||||||  8.7  (18 wins)
[2] claude-sonnet        |||||||||.  8.4  (15 wins)
[3] llama3.2:3b          |||||||...  7.1  (8 wins)
```

### 2. Cost-Quality Frontier

Is paying for cloud worth it?

```
💡 qwen2.5:7b matches sonnet within 0.3pts for FREE
   → Save $50/month, use local
```

### 3. Detailed Breakdown

See every prompt, response, and score:

```
[Code Generation Pack]
  Task: "Write a function to parse CSV"

  qwen2.5:7b     → 9/10  ✅ Handles edge cases, clean code
  llama3.2:3b    → 7/10  ⚠️  Works but missing error handling
  claude-sonnet  → 9/10  ✅ Perfect, but costs $0.02
```

### 4. Regression Detection

Quantized a model? See what broke:

```
❌ qwen2.5:2bit failed 8/10 tool-calling tests
   → JSON output format changed (single quotes)
   → Recommend: Use 4-bit instead
```

---

## Supported Models

### Local Inference

| Provider | Status | Auto-Discovery | Notes |
|----------|--------|----------------|-------|
| **Ollama** | ✅ Full | Yes | Any model, any host, MoE detection |
| **MLX** | ✅ Full | Yes | Apple Silicon optimized |
| **LM Studio** | ✅ Compatible | Coming | Works via localhost:1234 |
| **llama.cpp** | ✅ Compatible | Coming | Any OpenAI-compat server |

### Cloud Models

| Provider | Status | Notes |
|----------|--------|-------|
| **OpenRouter** | ✅ | One key = 200+ models |
| **OpenAI** | ✅ | Direct integration |
| **Anthropic** | ✅ | Via OpenRouter or proxy |
| **Groq** | ✅ | Direct (ultra-fast) |
| **Mistral** | ✅ | Direct |
| **Any OpenAI API** | ✅ | `base_url` + `api_key` |

**The judge can be any model** - including a local one. No cloud required!

---

## Example: Should I Pay for Sonnet?

### Your Task

You write TypeScript code daily. Should you use:
- 🆓 qwen2.5:7b (local, free)
- 💰 claude-sonnet ($3/million tokens)

### Create Eval Pack

```yaml
# eval-packs/my-coding.yaml
name: Daily TypeScript Work
cases:
  - prompt: "Write a function to debounce API calls"
    judge_criteria: "Code quality, edge cases, TypeScript types"

  - prompt: "Refactor this into async/await"
    context: |
      function getData(callback) {
        fetch('/api').then(r => callback(r))
      }
    judge_criteria: "Clean code, error handling"

  - prompt: "Debug: Why is this useState not updating?"
    context: |
      const [items, setItems] = useState([]);
      items.push(newItem); // Bug here
    judge_criteria: "Finds bug, explains why, fixes it"
```

### Run It

```bash
verdict run --pack my-coding
```

### Results

```
[1] qwen2.5:7b           ||||||||||  8.9  ($0.00, 850ms avg)
[2] claude-sonnet        |||||||||.  9.1  ($0.15, 1200ms avg)

💡 Cost-quality frontier:
   qwen2.5:7b scores 8.9/10 for FREE
   sonnet scores 9.1/10 but costs $0.15/run

   → Difference: 0.2pts
   → You run ~500 prompts/month
   → Switching to sonnet = $75/month for 0.2pt gain

   Decision: Use qwen2.5:7b, save $900/year
```

---

## Example: Quantization Testing

### Scenario

You quantized qwen2.5:7b to 2-bit. Did quality drop?

### Setup

```yaml
# verdict.yaml
models:
  - id: qwen-4bit
    provider: ollama
    model: qwen2.5:7b

  - id: qwen-2bit
    provider: ollama
    model: qwen2.5:2bit
```

### Run

```bash
verdict run --models "qwen-4bit,qwen-2bit"
```

### Results

```
Tool Calling Pack (10 cases)

qwen-4bit:  10/10 ✅ All JSON valid
qwen-2bit:   2/10 ❌ 8 failed (JSON parse errors)

Example failure:
  Expected: {"tool": "search", "query": "cats"}
  Got:      {'tool': 'search', 'query': 'cats'}
            ^ single quotes = invalid JSON

Verdict: 2-bit broke tool calling. Use 4-bit.
```

---

## Configuration

### verdict.yaml

```yaml
version: "1.0"
models:
  # Local models (Ollama)
  - id: qwen-fast
    provider: ollama
    model: qwen2.5:7b
    base_url: http://localhost:11434  # optional

  # Cloud models (OpenRouter)
  - id: sonnet
    provider: openrouter
    model: anthropic/claude-sonnet-4
    api_key: ${OPENROUTER_KEY}

  # Cloud models (direct)
  - id: gpt4
    provider: openai
    model: gpt-4o
    api_key: ${OPENAI_KEY}

judge:
  model_id: qwen-fast  # Use local model as judge (free!)
  temperature: 0.3
  max_tokens: 500

settings:
  parallel_requests: 3  # Run 3 evals at once
  timeout_seconds: 30
  retry_on_failure: true
```

### Eval Pack

```yaml
# eval-packs/code-generation.yaml
name: Code Generation
judge_criteria: |
  Rate 1-10 based on:
  - Correctness
  - Code quality
  - Edge case handling
  - Explanation clarity

cases:
  - prompt: "Write a function to deep clone an object"
    expected_behavior: "Handles nested objects, arrays, null"
    category: coding

  - prompt: |
      Fix this bug:
      const data = [1,2,3];
      data.length = 0;
      console.log(data); // Why is this empty?
    judge_criteria: "Explains array.length mutation correctly"
    category: debugging
```

---

## Advanced Features

### 1. Model Router

**Automatically route prompts to the best model based on eval history.**

```bash
# Route a prompt to the best model
verdict route "Debug this memory leak in React"

# Force a specific task type
verdict route "Summarize this document" --type summarize

# Prefer local models only
verdict route "Write unit tests" --prefer local

# Dry run — show which model would be selected without running
verdict route "your prompt" --dry-run
```

### 2. OpenAI-Compatible Proxy

Run verdict as a local HTTP server that automatically routes requests to the best model:

```bash
verdict serve --port 4000
```

Point any OpenAI client at `http://localhost:4000` — verdict selects the model based on eval history.

### 3. Background Daemon

Run evals, batch jobs, and synthesis in the background:

```bash
verdict daemon start   # Start background daemon
verdict daemon status  # Show queue depth, current job, uptime
verdict daemon logs    # Tail daemon logs
verdict daemon stop    # Stop the daemon
```

### 4. Watch for New Models

Automatically detect when new local models are installed:

```bash
verdict watch                         # Poll once
verdict watch --continuous            # Poll continuously (foreground)
verdict watch --interval 120          # Poll every 2 minutes
verdict watch --no-auto-eval          # Detect but don't auto-queue evals
```

### 5. Eval History

Query past eval results from the local SQLite database:

```bash
verdict history                       # Recent results
verdict history --model qwen2.5:7b    # Filter by model
verdict history --pack code-gen       # Filter by pack
verdict history --since 7d --trend    # Last 7 days with sparkline trends
verdict history --sort score          # Sort by score
```

### 6. Baseline Comparison

Track model improvements over time:

```bash
# Save current results as baseline
verdict baseline save v1.0

# Later, compare new run to baseline
verdict run
verdict baseline compare v1.0

# → qwen2.5:7b improved +0.8pts since v1.0
```

### 7. Config Validation

Check your config for errors before running:

```bash
verdict validate
verdict validate ./path/to/verdict.yaml
```

### 8. Custom Judges

Use different judge models for different packs:

```yaml
# eval-packs/creative-writing.yaml
name: Creative Writing
judge:
  model_id: sonnet  # Use smart judge for creative tasks
  temperature: 0.7
```

---

## Interactive TUI

Don't want to remember 18 subcommands? Run

```bash
verdict tui
```

You get a single keyboard-driven terminal app that covers the entire
workflow — browse runs, launch evals, diff baselines, manage the daemon,
edit config, test the router, all without leaving your terminal.

```
╭─────────────────────────────────────────────────────────────────────╮
│ verdict │ 1 Home  2 Runs  3 Models  4 Baselines  5 Daemon  6 Packs  │
╰─────────────────────────────────────────────────────────────────────╯

 ⚡ Top models  (avg across 15 runs)

  1. gpt-4o            8.66  ▁▃▆▆█  5 runs  last 8.80
  2. qwen-7b           7.70  ▁▃▆▇█  5 runs  last 8.20
  3. llama-3           7.32  ▇█▆▄▁  5 runs  last 6.90

 ⚠ 1 model regressed vs recent average: llama-3

 📈 Recent score trend  (top 3 models, last 5 runs)
     10.00 ┤
      8.33 ┤─╮──╭──╭──╯
      6.66 ┤  ╰──╯
      5.00 ┤

 🛰  Daemon   status: running   queue: 0   today: ✓ 14  ✗ 1

 :cmd  /filter  ?help  t:theme  ^o:back  q:quit
```

### Screens

| # | Screen | What it does |
|---|---|---|
| 1 | **Home** | Leaderboard, sparklines, trend chart, regression alerts, daemon status |
| 2 | **Runs** | Full history table with `/` fuzzy filter; Enter opens per-case drill-in |
| 3 | **Models** | Configured models + on-demand Ollama/MLX/LM Studio discovery |
| 4 | **Baselines** | List saved baselines, `s` saves latest, Enter diffs side-by-side |
| 5 | **Daemon** | Live job queue + tailing log (`p` to pause, `G` to resume) |
| 6 | **Eval Packs** | Browse every pack under `./eval-packs/`, drill into cases |
| · | **New Run** | Pick models + packs via Tab/Space, Enter launches with live progress |
| · | **Compare** | Pick two result JSONs, side-by-side diff with regression highlights |
| · | **Router** | Interactive prompt routing — type a prompt, see which model wins |
| · | **Serve** | Start/stop the OpenAI-compat HTTP proxy, watch request log |
| · | **Config** | Structured view of `verdict.yaml`; `E` opens `$EDITOR`, reloads on return |

### Keymap

**Global** (works from any screen)

| Key | Action |
|---|---|
| `:` | Command palette (fuzzy-matches every screen + action) |
| `/` | Filter the visible list |
| `?` | Help overlay with context-sensitive keybinds |
| `1`..`6` | Jump to tab 1..6 (lazygit-style) |
| `Tab` / `Shift+Tab` | Next / previous pane |
| `t` | Cycle theme (default → monokai → dracula → solarized) |
| `Ctrl-o` | Back (navigation history, last 20 screens) |
| `Esc` | Cancel / return to normal mode |
| `q` | Quit |

**List navigation**

| Key | Action |
|---|---|
| `j` / `k` or `↓` / `↑` | Next / previous row |
| `g` / `G` | Jump to top / bottom |
| `PgDn` / `PgUp` | Scroll by page |
| `Enter` | Open / drill in |

**Screen-specific** (most useful)

| Screen | Key | Action |
|---|---|---|
| Runs | `n` | Start a new run |
| Models | `d` | Discover local Ollama / MLX / LM Studio models |
| Baselines | `s` | Save latest result as a baseline |
| Daemon | `p` / `G` | Pause / resume log auto-scroll |
| New Run | `Space` | Toggle selection; `Tab` switches Models/Packs pane |
| Router | `Tab` | Cycle task type; `L` prefers local models |
| Serve | `s` | Start/stop proxy; `+`/`-` change port |
| Config | `E` | Open `verdict.yaml` in `$EDITOR`; `r` reloads & revalidates |

### Themes

Four presets ship in the box:

- `default` — ANSI 16-color (safe everywhere)
- `monokai` — warm, high-contrast
- `dracula` — cool purples and greens
- `solarized` — muted classic

Press `t` to cycle; your choice persists to `~/.verdict/tui-theme.json`
so it's remembered across sessions.

### Tips

- **Everything reachable via `:`** — if you forget a keybind, hit `:` and
  type a fragment of what you want (`com` → Compare, `rou` → Router,
  `con` → Config).
- **Filter anything with `/`** — on Runs, Models, Packs, the filter
  matches across multiple columns (model ID, pack, provider, run ID).
- **Back-button muscle memory** — `Ctrl-o` walks back like `hjkl` walks
  sideways; it remembers the last 20 screens.
- **`q` really quits** — even if a spinner is still animating, `q`
  unmounts React and terminates the process within 50ms.

---

## CLI Reference

```bash
# Setup
verdict init                            # Create verdict.yaml + eval-packs/
verdict validate [config]               # Check config for errors
verdict tui                             # Open the interactive terminal UI
verdict models                          # Ping all configured models
verdict models discover                 # Find Ollama/MLX models

# Maintenance
npm run doctor                          # Check native SQLite binding health
npm rebuild better-sqlite3              # Repair local SQLite native binding after Node changes
npm test                                # Run full test suite (runs doctor first)

# Run evals
verdict run                             # Run all packs, all models
verdict run -p code-gen                 # Run specific pack
verdict run -m "qwen,sonnet"            # Test specific models
verdict run --category reasoning        # Filter cases by category
verdict run --dry-run                   # Preview (no API calls)
verdict run --resume                    # Resume from checkpoint
verdict run --verbose                   # Print each result as it completes
verdict run --debug                     # Log raw provider requests
verdict run --json                      # JSON output (for CI/CD)
verdict run --fail-if-regression        # Exit 1 if regression vs baseline

# Compare and history
verdict compare <run-a.json> <run-b.json>  # Compare two result files
verdict history                             # View eval history
verdict history --model qwen2.5:7b          # Filter by model
verdict history --since 7d --trend          # Sparkline trends

# Baselines
verdict baseline save v1.0              # Save current as baseline
verdict baseline list                   # Show saved baselines
verdict baseline compare v1             # Compare to baseline

# Routing and serving
verdict route <prompt>                  # Route prompt to best model
verdict route <prompt> --prefer local   # Prefer local models
verdict route <prompt> --dry-run        # Show selected model only
verdict serve                           # Start OpenAI-compat proxy (port 4000)
verdict serve --port 8080               # Custom port

# Daemon
verdict daemon start                    # Start background daemon
verdict daemon stop                     # Stop daemon
verdict daemon status                   # Show queue depth and uptime
verdict daemon logs                     # Tail daemon logs

# Watch
verdict watch                           # Detect new local models
verdict watch --continuous              # Poll continuously
```

---

## Real-World Use Cases

### 1. Choosing Local vs Cloud

**Goal:** Stop paying $200/month for API calls

**Setup:**
- Add local model (qwen2.5:7b)
- Add cloud model (sonnet)
- Create eval pack from actual tasks

**Result:**
```
qwen2.5:7b: 8.5/10 ($0.00)
sonnet:     8.7/10 ($89.00/month)

→ Difference: 0.2pts
→ Savings: $2400/year
→ Decision: Use local
```

### 2. Regression Testing

**Goal:** Catch quality drops before users do

```bash
# Save current production model as baseline
verdict baseline save production-v1

# After updating model:
verdict run
verdict baseline compare production-v1
```

**Result:**
```
❌ REGRESSION DETECTED

Tool-calling: 9.2 → 6.1 (-3.1pts)
  8/10 tasks failed JSON parsing

→ DO NOT DEPLOY
→ Roll back to 4-bit
```

### 3. CI/CD Quality Gate

```bash
verdict run --json --fail-if-regression
# → Exit 1 if new model worse than baseline
```

### 4. Cost Optimization

**Goal:** Find cheapest model that meets quality bar

```yaml
models:
  - qwen2.5:7b     # Free
  - llama3.2:3b    # Free (faster)
  - haiku          # $0.25/M tokens
  - sonnet         # $3/M tokens
```

**Result:**
```
Quality bar: 8.0/10 minimum

qwen2.5:7b:  8.3/10 ✅ ($0.00)    ← USE THIS
llama3.2:3b: 7.1/10 ❌ (too low)
haiku:       8.9/10 ✅ ($12/mo)
sonnet:      9.2/10 ✅ ($89/mo)

→ qwen2.5:7b meets bar, saves $1068/year vs haiku
```

---

## Contributing

We welcome:
- 🐛 Bug reports
- 💡 Feature ideas
- 📝 Eval pack templates
- 🔧 Provider integrations
- 📊 Real-world benchmarking results

**Not currently accepting:**
- Major architecture changes (please discuss first)
- New dependencies without clear value
- Breaking API changes

See `CONTRIBUTING.md` for details.

---

## FAQ

### Do I need a cloud API key?

No. Local models (Ollama, MLX) work as both test subjects and judge.

### How is this different from MMLU/HellaSwag?

Those are generic academic benchmarks. Verdict tests YOUR tasks.

### Can I test proprietary models?

Yes. Any OpenAI-compatible API works (OpenRouter, Azure, custom endpoints).

### Does the judge need to be GPT-4?

No. Local models (qwen2.5:7b, mistral) make excellent judges.

### How long does a benchmark run take?

Depends on:
- Number of cases (10 = ~2 min, 100 = ~20 min)
- Model speed (local = fast, cloud = medium)
- Parallel requests (3 = default)

### Can I use this in CI/CD?

Yes. Exit code non-zero if quality drops:

```bash
verdict run --fail-if-regression
# → Exit 1 if new model worse than baseline
```

---

## License

MIT

---

## Links

- **GitHub:** https://github.com/hnshah/verdict
- **Issues:** https://github.com/hnshah/verdict/issues
- **Discussions:** https://github.com/hnshah/verdict/discussions

---

## Roadmap

**Shipped:**
- ✅ SQLite persistence + eval history
- ✅ Model router (auto-select best model per task)
- ✅ OpenAI-compatible serve mode
- ✅ Background daemon with job queue
- ✅ Watch mode (auto-detect new local models)
- ✅ Config validation

**Coming:**
- LM Studio auto-discovery
- Multi-judge consensus (2+ judges vote)
- Web UI dashboard
- CI/CD GitHub Action
- Prompt optimization (auto-improve prompts via evals)

---

**Built for developers tired of guessing which model to use.**

*Stop vibes-based model selection. Start making data-driven decisions.*
