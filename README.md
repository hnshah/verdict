# verdict

I build AI products. The question I kept asking was: which model should I actually use for this task?

Not "which model is best" in the abstract. That question is useless. Which model is best for my specific tasks, at my quality bar, given what I'm willing to pay vs. what I can run for free on my machine?

The honest answer: most people don't know. They eyeball outputs, pick a favorite, and move on. I did this for a long time. It led to bad decisions.

The [flash-moe paper](https://github.com/danveloper/flash-moe) made this concrete for me. It ran a 397-billion-parameter model on a 48GB laptop by streaming weights from SSD. The authors claimed 2-bit quantization produced output "indistinguishable" from 4-bit, based on three tasks. Then they discovered 2-bit broke JSON output and tool calling entirely, because the three tasks they tested didn't require structured output. The quality claim was wrong, and there was no tool to catch it.

**verdict is that tool.** Benchmark any model via OpenAI-compatible API. Get a scored leaderboard, a cost-quality comparison, and structured output validation. No account, no cloud dependency. Your data stays local.

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

**Who this is for:**
- **Developers running Ollama** who want to know which local model to use
- **Teams evaluating cloud vs. local** who want actual scores, not vibes
- **ML researchers testing quantization** who need rigorous output quality checks
- **Anyone using flash-moe or SSD-streaming inference** who wants to validate quality at different bit depths

## Quick start

```bash
npx verdict init
```

That creates `verdict.yaml` and starter eval packs. Edit it to add your models, then:

```bash
verdict models discover   # see what Ollama models you have installed
verdict models            # ping all configured models
verdict run               # run your first eval
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

verdict models discover      # shows all installed models with YAML to paste
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
and lower memory pressure than Ollama on M-series chips.

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

### MoE and quantization testing

MoE models activate only a fraction of expert weights per token, which makes them
well-suited for SSD-streaming inference on consumer hardware. flash-moe demonstrated
this by running Qwen3.5-397B on a 48GB MacBook at 4+ tokens/second.

If you are running a custom inference server (flash-moe or similar), add it
as a generic compat endpoint:

```yaml
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

The quantization pack uses deterministic JSON scoring (no LLM judge needed)
to catch exactly the failure mode the flash-moe paper missed.

## Cloud models

Any OpenAI-compatible endpoint works. One config entry per model.

```yaml
  # OpenRouter (one key, access to every cloud model)
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
  model: <model-id>            # references a model id from models[]
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
  cache: true

output:
  dir: ./results
  formats: [json, markdown]
```

All values support `${ENV_VAR}` and `${ENV_VAR:-default}` substitution.

## Eval packs

| Pack | Cases | Scorer | Focus |
|------|-------|--------|-------|
| `general.yaml` | 10 | LLM judge | Factual recall, reasoning, coding, instruction following |
| `moe.yaml` | 5 | LLM judge | Multi-domain tasks that highlight MoE model strengths |
| `quantization.yaml` | 10 | Mixed (JSON + LLM) | Structured output, tool calling format, instruction precision |

The quantization pack uses deterministic JSON scoring for cases 1-3 and 7:
`JSON.parse()` pass or fail, no LLM needed. If a model produces `'name'` instead
of `"name"`, it fails. These are the cases that caught the flash-moe 2-bit regression.

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

See [docs/writing-eval-packs.md](docs/writing-eval-packs.md) for full documentation.

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

- `YYYY-MM-DD-<run-id>.json` - full results with per-case scores
- `YYYY-MM-DD-<run-id>.md` - leaderboard and case detail report

## Docs

- [Getting started](docs/getting-started.md)
- [Provider setup: Ollama, MLX, OpenRouter, flash-moe](docs/providers.md)
- [Writing eval packs](docs/writing-eval-packs.md)
- [Quantization testing](docs/quantization.md)

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

The highest-value contribution is a well-designed eval pack for a domain we
don't cover yet.

## License

MIT
