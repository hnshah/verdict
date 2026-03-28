# Quick Start (5 minutes)

Get up and running with Verdict in 5 minutes.

## Step 1: Install

```bash
npm install -g verdict
```

## Step 2: Initialize

```bash
mkdir my-evals && cd my-evals
verdict init
```

This creates:
- `verdict.yaml` - Your config file
- `eval-packs/` - Example test cases

## Step 3: Configure Models

Edit `verdict.yaml`:

```yaml
models:
  # Local models (free)
  - id: qwen2.5:7b
    provider: ollama
    
  # Cloud models (paid)
  - id: claude-sonnet
    provider: anthropic
    api_key: ${ANTHROPIC_API_KEY}

judge:
  model_id: claude-haiku
  provider: anthropic
```

**Tip:** Use environment variables for API keys!

## Step 4: Run Your First Eval

```bash
verdict run
```

**Output:**
```
Models: qwen2.5:7b, claude-sonnet
Judge:  claude-haiku
Cases:  15 across 2 packs

[1] qwen2.5:7b        ||||||||||  8.7  Fast, accurate
[2] claude-sonnet     |||||||||.  8.4  Best reasoning

Winner: qwen2.5:7b (8.7/10, $0.00)
```

## Step 5: Interpret Results

**What the scores mean:**
- **8-10:** Excellent - production ready
- **6-8:** Good - suitable for most tasks
- **4-6:** Fair - specific use cases only
- **<4:** Poor - not recommended

**Cost-quality frontier:**
> "qwen2.5:7b matches sonnet within 0.3pts for FREE"

This means: use the local model, save money!

## Next Steps

- **More models:** Add GPT-4, Llama, etc. to `verdict.yaml`
- **Custom tests:** Create eval packs for your use case
- **Compare runs:** `verdict compare run-1.json run-2.json`
- **Save baselines:** `verdict baseline save v1.0`

## Common Issues

**"No models found"**
- Check Ollama is running: `ollama serve`
- Verify model installed: `ollama list`

**"API key invalid"**
- Set environment variable: `export ANTHROPIC_API_KEY=sk-...`
- Or add to verdict.yaml: `api_key: sk-...`

**"Judge failed"**
- Judge model must be cheap/fast (use haiku/gpt-3.5)
- If using local judge, ensure it's running

---

**You're ready!** 🎉

Next: [Model Comparison Workflow →](./02-model-comparison.md)
