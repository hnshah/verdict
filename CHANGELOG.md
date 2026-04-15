# Changelog

## 0.3.0 (2026-04-15)

### `verdict tui` — the full interactive terminal UI

A single keyboard-driven app that covers the entire Verdict workflow.
Run `verdict tui` to open it.

**13 screens**

- **Home** — leaderboard with sparklines, multi-series trend chart,
  regression alerts for models whose latest score slid vs recent max,
  daemon status, most-recent-run summary
- **Runs** — full history table, `/` fuzzy filter across model / pack /
  provider / run ID, Enter drills into per-case scores + responses
- **Run Detail** — every case of a run with per-case score, latency,
  and response preview
- **Live Run** — streaming runner with 30 fps-throttled progress
- **New Run** — wizard: Tab between Models + Packs panes, Space
  toggles, Enter launches
- **Models** — configured models + on-demand Ollama/MLX/LM Studio
  discovery
- **Baselines** — list, `s` saves latest result, Enter diffs latest
  against selected via synced side-by-side `DiffPane`
- **Compare** — pick two result JSONs from `config.output.dir`,
  side-by-side diff with regression highlights
- **Daemon** — live IPC status, recent jobs table, tailing log with
  `p` to pause and `G` to resume (lazygit-style)
- **Eval Packs** — browse every `*.yaml` in `./eval-packs/` +
  `./multimodal-evals/`, drill into cases with prompt + criteria
- **Router** — interactive prompt routing; Tab cycles task type,
  `L` toggles prefer-local, Enter actually calls the selected model
  and shows the response inline
- **Serve** — managed child process for the OpenAI-compat HTTP proxy,
  `s` starts/stops, `+`/`-` tune port, live log tail
- **Config** — structured view of `verdict.yaml`; `E` shells out to
  `$EDITOR`, revalidates via Zod on return; `r` reloads

**Patterns**

- Vim-style modes: normal / command / filter / help / insert
- `:` command palette with Fuse.js fuzzy match over every action
- `/` universal list filter
- `?` context-sensitive help overlay
- `1..6` lazygit-style tab jumps, `hjkl` + `g/G` + PgUp/PgDn navigation
- `Ctrl-o` back through the last 20 screen transitions
- `t` cycles through four themes (default, monokai, dracula, solarized),
  persisted to `~/.verdict/tui-theme.json`
- `q` force-terminates the process within 50 ms (avoids lingering
  handles from SQLite / timers)

**Built on**

- [Ink 6](https://github.com/vadimdemedes/ink) + React 19 — same stack
  as Claude Code, Gemini CLI, GitHub Copilot CLI
- `@inkjs/ui`, `fuse.js`, `asciichart`, `sparkly`
- Reuses existing `runEvals`, `queryHistory`, `getJobs`, `sendIpc`,
  `discoverOllama/MLX`, `loadConfig`, `baseline.ts` — no new subprocess
  layer, zero changes to existing CLI commands, `--json` output, SQLite
  schema, or the GitHub Action

**Quality**

- 17 `ink-testing-library` smoke tests
- 42-assertion real-PTY (tmux) smoke test walking every screen
- 358 total tests passing

## 0.2.0 (2026-03-24)

- **`verdict compare`** — compare two result JSON files side-by-side: score deltas per model, rank changes, notable per-case score changes (Δ ≥ 1.0), and overall verdict. `--output` flag saves a markdown report.
- **4 new eval packs:** `coding.yaml` (10 cases), `reasoning.yaml` (10 cases), `instruction-following.yaml` (10 cases), `writing-quality.yaml` (8 cases). Total: 53 cases across 7 packs.
- **Build fix:** switched to `tsup.config.ts` to fix `--banner.js` flag compatibility with tsup 8.x.

## 0.1.0 (2026-03-24)

Initial release.

- Universal OpenAI-compatible provider (covers Ollama, MLX, OpenRouter, OpenAI, Groq, Mistral, LM Studio, flash-moe, any compat endpoint)
- Deep Ollama integration: auto-discover models, MoE detection, any host
- MLX (Apple Silicon) integration: mlx-lm server auto-detection
- Blind LLM judge with weighted rubric scoring (accuracy, completeness, conciseness)
- Deterministic scorers: `json` (JSON.parse), `exact`, `contains`
- Cost-quality frontier output
- Eval packs: `general.yaml` (10 cases), `moe.yaml` (5 cases), `quantization.yaml` (10 cases)
- CLI: `verdict init`, `verdict run`, `verdict models`, `verdict models discover`
- JSON and Markdown output
- Config-as-code with `${ENV_VAR:-default}` substitution throughout
