# Getting started

## Requirements

- Node.js 18 or later
- At least one model to evaluate (Ollama locally, or a cloud API key)

## Install

```bash
npm install -g verdict
```

Or run without installing:

```bash
npx verdict init
```

## Your first eval run

### Step 1: Create config

```bash
verdict init
```

This creates `verdict.yaml` and two starter eval packs. Open `verdict.yaml` and
add at least one model.

### Step 2: Check what's available

If you have Ollama installed:

```bash
verdict models discover
```

This scans for running inference servers and shows what models are installed.
Copy the YAML snippet it outputs into your `verdict.yaml`.

### Step 3: Verify connectivity

```bash
verdict models
```

Pings every configured model. Shows latency and any auth errors.

### Step 4: Run evals

```bash
verdict run --dry-run   # preview what will run
verdict run             # run for real
```

Results save to `./results/` as JSON and Markdown.

## Choosing a judge model

The judge is the model that scores responses. It should be capable and reliable.
A cloud model (GPT-4o mini, Claude Haiku, Gemini Flash) works well and is cheap.

If you are benchmarking local-only and want no cloud dependency, you can use a
local model as judge. Quality of scores will depend on the judge's capabilities.

The judge never sees model names when `blind: true` (the default).

## Running specific packs

```bash
verdict run --pack ./eval-packs/quantization.yaml
verdict run --pack quantization,moe
```

## Running specific models

```bash
verdict run --models local-fast,cloud-mini
```

## Next steps

- [Writing eval packs](./writing-eval-packs.md)
- [Provider setup: Ollama and MLX](./providers.md)
- [Quantization testing with flash-moe](./quantization.md)
