# Changelog

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
