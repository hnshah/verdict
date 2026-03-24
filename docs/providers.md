# Provider setup

verdict uses the OpenAI-compatible API format as a universal wire protocol.
Every inference server gets one config entry in `verdict.yaml`.

## Ollama

Run models locally. No API key. Works on any machine with Ollama installed.

**Install:** https://ollama.ai

**Start:**
```bash
ollama serve
ollama pull qwen2.5:7b
```

**Config:**
```yaml
- id: qwen-local
  provider: ollama
  model: qwen2.5:7b
  host: "${OLLAMA_HOST:-localhost:11434}"
  tags: [local, free]
```

**Remote Ollama:**
Set `OLLAMA_HOST=192.168.1.100:11434` to run evals against a remote machine.

**MoE models:**
```bash
ollama pull deepseek-r1:7b    # 7B active, ~67B total
ollama pull mixtral:8x7b
```

verdict auto-detects MoE models by name and tags them.

## MLX (Apple Silicon)

Runs models natively on M-series chips. Generally faster than Ollama on Apple Silicon.

**Install:**
```bash
pip install mlx-lm
```

**Start:**
```bash
mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit --port 8080
```

**Config:**
```yaml
- id: llama-mlx
  provider: mlx
  model: mlx-community/Llama-3.2-3B-Instruct-4bit
  port: "${MLX_PORT:-8080}"
  tags: [local, free, apple-silicon]
```

**MoE via MLX:**
```bash
mlx_lm.server --model mlx-community/DeepSeek-R1-8B-Instruct-4bit --port 8080
```

## OpenRouter

One API key that gives access to every major cloud model.

**Get a key:** https://openrouter.ai

**Config:**
```yaml
- id: cloud-fast
  base_url: "https://openrouter.ai/api/v1"
  api_key: "${OPENROUTER_API_KEY}"
  model: "anthropic/claude-haiku-3-5"
  cost_per_1m_input: 0.80
  cost_per_1m_output: 4.00
```

## OpenAI

```yaml
- id: gpt4o-mini
  base_url: "https://api.openai.com/v1"
  api_key: "${OPENAI_API_KEY}"
  model: gpt-4o-mini
  cost_per_1m_input: 0.15
  cost_per_1m_output: 0.60
```

## Groq

Fast inference for open models via cloud.

```yaml
- id: groq-llama
  base_url: "https://api.groq.com/openai/v1"
  api_key: "${GROQ_API_KEY}"
  model: llama-3.1-8b-instant
```

## flash-moe or custom inference server

Any HTTP server implementing the OpenAI `/v1/chat/completions` endpoint works:

```yaml
- id: flash-moe-local
  base_url: "http://localhost:8080/v1"
  api_key: "none"
  model: "qwen3.5-397b"
  tags: [local, free, moe, ssd-streaming]
```

## LM Studio

```yaml
- id: lmstudio
  base_url: "http://localhost:1234/v1"
  api_key: "none"
  model: "lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF"
```

## Environment variables

All values in `verdict.yaml` support `${VAR}` and `${VAR:-default}` substitution.

Create a `.env` file (copy from `.env.example`):

```
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
OLLAMA_HOST=localhost:11434
MLX_PORT=8080
```
