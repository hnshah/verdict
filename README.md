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

# Dry run (preview without API calls)
verdict run --dry-run
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

| Provider | Status | One-Liner Setup |
|----------|--------|-----------------|
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

**Data-driven decision made!** ✅

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
  
  - prompt: |
      Fix this bug:
      const data = [1,2,3];
      data.length = 0;
      console.log(data); // Why is this empty?
    judge_criteria: "Explains array.length mutation correctly"
```

---

## Advanced Features

### 1. Model Router (New! 🎉)

**Automatically choose the best model for each task.**

```typescript
import { VerdictRouter } from 'verdict';

const router = new VerdictRouter('./verdict.db');

// Routes to best model based on task type
const result = await router.route(
  "Debug this memory leak in React"
);

console.log(`Using: ${result.choice.model}`);
// → "Using: qwen2.5:7b (code-generation specialist)"
```

**Features:**
- ✅ Learns from eval results (which model wins for which tasks?)
- ✅ Auto-classifies tasks (code, reasoning, tool-calling, creative)
- ✅ Balances quality, cost, and speed
- ✅ DSPy-optimized routing (60% accuracy, improving with data)

**Shadow Mode** - Test new routing logic safely:
```typescript
const router = new VerdictRouter('./verdict.db', {
  shadowMode: true  // Logs both routers, uses primary
});

// After 100 decisions:
const stats = router.getShadowStats();
console.log(`Agreement: ${stats.agreement_rate}`);
```

### 2. Baseline Comparison

Track model improvements over time:

```bash
# Save current results as baseline
verdict baseline save v1.0

# Later, compare new run to baseline
verdict run
verdict baseline compare v1.0

# → qwen2.5:7b improved +0.8pts since v1.0
```

### 3. Custom Judges

Use different judge models for different packs:

```yaml
# eval-packs/creative-writing.yaml
name: Creative Writing
judge:
  model_id: sonnet  # Use smart judge for creative tasks
  temperature: 0.7
```

### 4. Inference Optimization

```yaml
# verdict.yaml
models:
  - id: qwen-fast
    provider: ollama
    model: qwen2.5:7b
    parameters:
      num_gpu: 99  # Use all GPU layers
      num_ctx: 8192  # Larger context
      temperature: 0.1  # More deterministic
```

---

## CLI Reference

```bash
# Setup
verdict init                  # Create verdict.yaml + eval-packs/
verdict models                # Ping all configured models
verdict models discover       # Find Ollama/MLX models

# Run evals
verdict run                   # Run all packs, all models
verdict run -p code-gen       # Run specific pack
verdict run -m "qwen,sonnet"  # Test specific models
verdict run --dry-run         # Preview (no API calls)
verdict run --resume          # Resume from checkpoint

# Compare models
verdict compare               # Head-to-head comparison UI

# Baselines
verdict baseline save v1.0    # Save current as baseline
verdict baseline list         # Show saved baselines
verdict baseline compare v1   # Compare to baseline

# Router
verdict infer "your prompt"   # Route single task (for testing)
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

**Setup:**
```bash
# Save current production model as baseline
verdict baseline save production-v1

# After updating model:
verdict run
verdict baseline compare production-v1
```

**Result:**
```
❌ NEW MODEL REGRESSION DETECTED

Tool-calling: 9.2 → 6.1 (-3.1pts) 
  8/10 tasks failed JSON parsing

→ DO NOT DEPLOY
→ Roll back to 4-bit
```

### 3. Cost Optimization

**Goal:** Find cheapest model that meets quality bar

**Setup:**
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

No! You can use local models (Ollama, MLX) as both test subjects AND judge.

### How is this different from MMLU/HellaSwag?

Those are generic academic benchmarks. Verdict tests YOUR tasks.

### Can I test proprietary models?

Yes! Any OpenAI-compatible API works (OpenRouter, Azure, custom endpoints).

### Does the judge need to be GPT-4?

No! Local models (qwen2.5:7b, mistral) make excellent judges.

### How long does a benchmark run take?

Depends on:
- Number of cases (10 = ~2 min, 100 = ~20 min)
- Model speed (local = fast, cloud = medium)
- Parallel requests (3 = default)

### Can I use this in CI/CD?

Yes! Exit code non-zero if quality drops:

```bash
verdict run --baseline production --fail-if-regression
# → Exit 1 if new model worse than baseline
```

---

## License

MIT

---

## Links

- **GitHub:** https://github.com/yourusername/verdict
- **Docs:** https://verdict.dev
- **Discord:** https://discord.gg/verdict

---

## Roadmap

**Shipping Now:**
- ✅ Model router (auto-select best model per task)
- ✅ Shadow mode (safe A/B testing)
- ✅ DSPy-optimized routing

**Coming Q2 2026:**
- LM Studio auto-discovery
- Multi-judge consensus (2+ judges vote)
- Tag-based filtering (`verdict run --tags "quick,sanity"`)
- Web UI dashboard
- CI/CD GitHub Action

**Considering:**
- Prompt optimization (auto-improve prompts via evals)
- Dataset generation (create eval packs from logs)
- Model fine-tuning integration (eval → retrain loop)

Vote on features: https://github.com/yourusername/verdict/discussions

---

**Built with ❤️ by developers tired of guessing which model to use.**

*Stop vibes-based model selection. Start making data-driven decisions.*

---

Developed with cloud and local AI assistance.
