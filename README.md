# verdict

**LLM eval framework. Benchmark local and cloud models with one config file.**

Compare Ollama models, MLX (Apple Silicon), MoE models, and cloud APIs. Get a leaderboard, cost-quality analysis, and delta reports. No account needed. Your data stays local.

```
  verdict run

  Models: local-fast, local-moe, cloud-mini
  Judge:  cloud-mini
  Cases:  10 across 1 pack(s)

  [1] local-fast           ||||||||||  8.4  Accurate and complete, slightly verbose
  [2] local-moe            |||||||||.  8.1  Strong reasoning, brief answers
  [3] cloud-mini           |||||||||.  8.0  Concise and correct

  Winner: local-fast (8.4/10, 6 wins)

  Cost-quality frontier
  local-fast matches cloud-mini within 0.4pts. Use the free model.
```

## Quick start

```bash
npx verdict init
# edit verdict.yaml, add your models
npx verdict models discover   # see what Ollama models you have
npx verdict run
```

## Install

```bash
npm install -g verdict
```

Node.js 18+ required.

## Local inference

### Ollama

verdict has deep Ollama integration. It auto-discovers running models,
detects MoE architectures, and needs zero API keys.

```bash
# Install Ollama: https://ollama.ai
ollama pull qwen2.5:7b
ollama pull deepseek-r1:7b   # MoE model

verdict models discover      # shows all installed models
```

In verdict.yaml:

```yaml
models:
  - id: qwen-local
    provider: ollama
    model: qwen2.5:7b
    host: "${OLLAMA_HOST:-localhost:11434}"
    tags: [local, free]

  - id: deepseek-moe
    provider: ollama
    model: deepseek-r1:7b
    tags: [local, free, moe]
```

Point `OLLAMA_HOST` at any machine to use a remote Ollama instance.

### MLX (Apple Silicon)

MLX runs models natively on Apple Silicon via mlx-lm. Faster inference
and lower memory than Ollama on M-series chips.

```bash
pip install mlx-lm
mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit --port 8080
```

In verdict.yaml:

```yaml
  - id: llama-mlx
    provider: mlx
    model: mlx-community/Llama-3.2-3B-Instruct-4bit
    port: "${MLX_PORT:-8080}"
    tags: [local, free, mlx, apple-silicon]
```

### MoE models

Mixture-of-Experts models activate different expert weights per token.
They often match dense models above their size class, especially on
multi-domain tasks. verdict tags and tracks MoE models automatically.

```bash
# Via Ollama
ollama pull deepseek-r1:7b     # 7B active, 671B total
ollama pull mixtral:8x7b
ollama pull qwen2.5:14b-instruct  # includes MoE variants

# Via MLX
mlx_lm.server --model mlx-community/DeepSeek-R1-8B-Instruct-4bit
```

Use `eval-packs/moe.yaml` to run tasks that highlight MoE strengths:
multi-domain reasoning, cross-language tasks, and applied problem solving.

## Cloud models

Any OpenAI-compatible endpoint works. One config entry per model.

```yaml
  # OpenRouter (one key, every cloud model)
  - id: cloud-fast
    base_url: "https://openrouter.ai/api/v1"
    api_key: "${OPENROUTER_API_KEY}"
    model: "anthropic/claude-haiku-3-5"
    cost_per_1m_input: 0.80
    cost_per_1m_output: 4.00

  # Direct OpenAI
  - id: gpt4o-mini
    base_url: "https://api.openai.com/v1"
    api_key: "${OPENAI_API_KEY}"
    model: gpt-4o-mini

  # Groq (fast inference)
  - id: groq-llama
    base_url: "https://api.groq.com/openai/v1"
    api_key: "${GROQ_API_KEY}"
    model: llama-3.1-8b-instant
```

## Config reference

```yaml
# verdict.yaml
name: "My Evals"

models:
  - id: <string>               # your label for this model
    provider: ollama | mlx     # optional shorthand for local providers
    base_url: <url>            # or raw OpenAI-compat endpoint
    api_key: <string>          # use "none" for local endpoints
    model: <string>            # model name as the endpoint expects it
    host: <host:port>          # Ollama: override host
    port: <number>             # MLX: port (default 8080)
    tags: [local, cloud, moe, ...]
    cost_per_1m_input: <number>
    cost_per_1m_output: <number>
    timeout_ms: <number>       # default 120000
    max_tokens: <number>       # default 1024

judge:
  model: <model-id>            # references a model from models[]
  blind: true                  # never reveals model names to judge
  rubric:
    accuracy: 0.4
    completeness: 0.4
    conciseness: 0.2

packs:
  - ./eval-packs/general.yaml

run:
  concurrency: 3               # parallel model calls per case
  retries: 2
  cache: true                  # cache responses to resume interrupted runs

output:
  dir: ./results
  formats: [json, markdown]
  delta: true                  # compare vs previous run
```

All values support `${ENV_VAR}` and `${ENV_VAR:-default}` substitution.

## Eval packs

Eval cases are portable YAML. Comes with:

| Pack | Cases | Focus |
|------|-------|-------|
| `general.yaml` | 10 | Factual, reasoning, coding, instruction following |
| `moe.yaml` | 5 | Multi-domain tasks that highlight MoE strengths |

Write your own:

```yaml
# eval-packs/my-pack.yaml
name: My Tasks
cases:
  - id: my-001
    prompt: "Your prompt here"
    criteria: "What a good answer must include"
    tags: [custom]
```

## CLI reference

```bash
verdict init                         # create verdict.yaml + starter packs
verdict run                          # run with ./verdict.yaml
verdict run --config other.yaml      # custom config
verdict run --models local-fast      # run subset of models
verdict run --pack moe               # run specific pack
verdict run --dry-run                # preview without API calls
verdict models                       # ping all configured models
verdict models discover              # scan for local inference servers
```

## Results

Every run saves to `./results/`:

- `YYYY-MM-DD-<run-id>.json` - full results
- `YYYY-MM-DD-<run-id>.md` - leaderboard and case detail report

## License

MIT
