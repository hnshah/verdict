# verdict

> "Output quality at 2-bit is indistinguishable from 4-bit for these evaluations."
>
> flash-moe paper, March 2026

Those evaluations were three prompts. A few days later the repo was updated: 2-bit broke JSON output. String keys came back single-quoted. Unparseable. Tool calling stopped working. Recommendation changed to 4-bit.

The authors were thorough about the engineering. The quality validation was not. There was no tool to catch it before the claim shipped.

**verdict turns model decisions into data.** Run eval packs against any model via OpenAI-compatible API. Get a leaderboard, cost-quality comparison, and structured output validation. Config lives in your repo. Zero cloud dependency.

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

The "cost-quality frontier" line answers the core question: is paying for cloud worth it for your tasks?

**Who this is for:**
- You run Ollama and want to know which local model to use for your actual tasks, not a generic benchmark
- You are deciding whether paying for cloud is worth it or whether a free local model is close enough
- You just quantized a model and need to know what broke
- You make model decisions on intuition and want to stop

## What's supported

**Local inference**

| Provider | Integration | Notes |
|----------|-------------|-------|
| Ollama | Deep: auto-discover, MoE detection, any host | `verdict models discover` |
| MLX (Apple Silicon) | Deep: mlx-lm server auto-detect | Faster than Ollama on M-series |
| LM Studio | Generic compat (localhost:1234) | Works today, no auto-discover yet |
| flash-moe + custom servers | Generic compat (any port) | Any OpenAI-compat HTTP endpoint |

**Cloud**

| Provider | How |
|----------|-----|
| OpenRouter | One key, access to every major model |
| OpenAI | Direct |
| Anthropic | Via OpenRouter or compat proxy |
| Groq | Direct |
| Mistral | Direct |
| Any OpenAI-compat API | `base_url` + `api_key` in config |

**The judge can be any model in your config, including a local one.** No cloud account required to get started if you have Ollama running.

**Coming**
- LM Studio discovery (currently works via compat, no auto-detect yet)
- `verdict compare` for run-vs-run deltas
- Cross-judge strategy (two judge models, averaged scores)
- Tag-based case filtering

## Quick start

`npx verdict init` creates `verdict.yaml` and starter eval packs in your current directory.

```bash
npx verdict init
```

Add your models to `verdict.yaml`, then:

```bash
verdict models discover   # find installed Ollama models, get YAML to paste in
verdict models            # ping all configured models
verdict run               # run evals
```

## Install

```bash
npm install -g verdict
```

Node.js 18+ required.

## Local inference

### Ollama

Run `verdict models discover` and it lists every installed Ollama model with the config YAML ready to paste in. MoE models (Mixture-of-Experts architectures like DeepSeek-R1 and Mixtral) are detected and tagged automatically. No API key needed.

```bash
# Install Ollama: https://ollama.ai
ollama pull qwen2.5:7b
ollama pull deepseek-r1:7b

verdict models discover
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

Set `OLLAMA_HOST` to run evals against a remote machine running Ollama.

### MLX (Apple Silicon)

MLX runs models natively on M-series chips via mlx-lm, generally faster than Ollama on Apple Silicon.

```bash
pip install mlx-lm
mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit --port 8080
```

```yaml
  - id: llama-mlx
    provider: mlx
    model: mlx-community/Llama-3.2-3B-Instruct-4bit
    port: "${MLX_PORT:-8080}"
    tags: [local, free, apple-silicon]
```

### LM Studio and custom servers

LM Studio, flash-moe, and any other server that implements the OpenAI `/v1/chat/completions` endpoint works as a generic compat provider:

```yaml
  # LM Studio (default port 1234)
  - id: lmstudio
    base_url: "http://localhost:1234/v1"
    api_key: "none"
    model: "meta-llama-3-8b-instruct"
    tags: [local, free]

  # flash-moe or any custom server
  - id: flash-moe-local
    base_url: "http://localhost:8080/v1"
    api_key: "none"
    model: "qwen3.5-397b"
    tags: [local, free, moe, ssd-streaming]
```

Then run the quantization pack to validate output quality:

```bash
verdict run --pack ./eval-packs/quantization.yaml
```

## Cloud models

```yaml
  # OpenRouter: one key, every major cloud model
  - id: cloud-fast
    base_url: "https://openrouter.ai/api/v1"
    api_key: "${OPENROUTER_API_KEY}"
    model: "anthropic/claude-haiku-3-5"
    cost_per_1m_input: 0.80
    cost_per_1m_output: 4.00

  # OpenAI
  - id: gpt4o-mini
    base_url: "https://api.openai.com/v1"
    api_key: "${OPENAI_API_KEY}"
    model: gpt-4o-mini

  # Groq
  - id: groq-llama
    base_url: "https://api.groq.com/openai/v1"
    api_key: "${GROQ_API_KEY}"
    model: llama-3.1-8b-instant
```

## Eval packs

| Pack | Cases | Focus |
|------|-------|-------|
| `general.yaml` | 10 | Factual recall, reasoning, coding, instruction following |
| `moe.yaml` | 5 | Multi-domain tasks that highlight MoE model strengths |
| `quantization.yaml` | 10 | JSON output (3), tool calling (1), structured data (2), instruction precision (4) |

The quantization pack uses deterministic scoring (`JSON.parse()` pass or fail) where structured output is required. No LLM judge call. If a model produces `'name'` instead of `"name"`, it fails. These are the cases that would have caught the flash-moe 2-bit regression before the paper shipped.

Write your own:

```yaml
# eval-packs/my-pack.yaml
name: My Tasks
cases:
  - id: my-001
    prompt: "Your prompt here"
    criteria: "What a good answer must include"
    scorer: llm    # or: json, exact, contains
    tags: [custom]
```

See [docs/writing-eval-packs.md](docs/writing-eval-packs.md) for scorer types, criteria writing, and quantization-sensitive case patterns.

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
    host: <host:port>          # Ollama: override default host
    port: <number>             # MLX: port (default 8080)
    tags: [local, cloud, moe, ...]
    cost_per_1m_input: <number>
    cost_per_1m_output: <number>
    timeout_ms: <number>       # default 120000
    max_tokens: <number>       # default 1024

judge:
  model: <model-id>            # any model id from the list above, local or cloud
  blind: true                  # model names never shown to the judge
  rubric:
    accuracy: 0.4              # is it correct?
    completeness: 0.4          # does it cover the criteria?
    conciseness: 0.2           # is it appropriately brief?

packs:
  - ./eval-packs/general.yaml

run:
  concurrency: 3               # parallel model calls per case
  retries: 2
  cache: true                  # resume interrupted runs

output:
  dir: ./results
  formats: [json, markdown]
```

All values support `${ENV_VAR}` and `${ENV_VAR:-default}` substitution. Store keys in `.env` (see `.env.example`).

## CLI reference

```bash
verdict init                             # create verdict.yaml and starter packs
verdict run                              # run with ./verdict.yaml
verdict run --config other.yaml          # custom config
verdict run --models local-fast          # run subset of models
verdict run --pack ./eval-packs/moe.yaml # run specific pack
verdict run --dry-run                    # preview without API calls
verdict models                           # ping all configured models
verdict models discover                  # scan for local inference servers
```

## Results

Every run saves to `./results/`:

- `YYYY-MM-DD-<run-id>.json` - full results with per-case scores and responses
- `YYYY-MM-DD-<run-id>.md` - leaderboard, cost-quality frontier, and case detail report

## Docs

- [Getting started](docs/getting-started.md)
- [Provider setup: Ollama, MLX, OpenRouter, flash-moe](docs/providers.md)
- [Writing eval packs](docs/writing-eval-packs.md)
- [Quantization testing with flash-moe](docs/quantization.md)

## Contributing

The best contribution is a well-designed eval pack for a domain we don't cover yet: coding, reasoning, instruction-following, domain-specific. [Open an eval pack issue](https://github.com/hnshah/verdict/issues/new?template=eval-pack.yml) to propose one. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
