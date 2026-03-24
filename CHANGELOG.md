# Changelog

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
