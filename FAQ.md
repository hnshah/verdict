# Verdict FAQ

**Frequently Asked Questions** - organized by category for quick answers.

---

## Table of Contents

1. [General Questions](#general-questions)
2. [Installation & Setup](#installation--setup)
3. [Model Support](#model-support)
4. [Judging & Scoring](#judging--scoring)
5. [Eval Packs](#eval-packs)
6. [Results & Interpretation](#results--interpretation)
7. [Advanced Features](#advanced-features)
8. [Cost & Pricing](#cost--pricing)
9. [Performance](#performance)
10. [Troubleshooting](#troubleshooting)
11. [Community & Support](#community--support)
12. [Enterprise](#enterprise)

---

## General Questions

### What is Verdict?

Verdict is a CLI tool that helps you choose which AI model to use by running YOUR real-world tasks against multiple models and giving you data-driven recommendations.

Instead of guessing based on vibes or generic benchmarks (MMLU, HellaSwag), Verdict tests models on tasks that actually matter to you.

---

### Do I need cloud API keys?

**No!** Verdict works entirely with local models (Ollama, MLX) if you want. You can:
- Use local models as test subjects
- Use a local model as the judge
- Run everything for $0

API keys are only needed if you want to test cloud models (OpenAI, Anthropic, etc.).

---

### How is this different from MMLU/HellaSwag/generic benchmarks?

**Generic benchmarks test academic knowledge:**
- "What is the capital of France?"
- "Complete this sentence..."
- Tasks nobody actually does in production

**Verdict tests YOUR real-world tasks:**
- "Parse our customer CSV format"
- "Debug this React code"
- "Write a customer support response"

**Result:** Verdict tells you which model works best for YOUR specific use case.

---

### Can I use Verdict without installing anything?

**Yes!** Use `npx`:

```bash
npx verdict init
npx verdict run
```

No global install needed. npx downloads and runs Verdict temporarily.

---

### Is Verdict free?

**Yes!** Verdict is open-source (MIT license). 

**Runtime costs:**
- Local models only → $0
- Cloud models → you pay their API costs

**Example:** Testing 3 local models on 25 tasks = $0

---

## Installation & Setup

### How do I install Verdict?

**Option 1: Global install (recommended)**
```bash
npm install -g verdict
```

**Option 2: npx (no install)**
```bash
npx verdict init
```

**Option 3: Project dependency**
```bash
npm install verdict
```

---

### Which Node.js version do I need?

**Node.js 18 or higher.**

Check your version:
```bash
node --version
```

If you need to upgrade: https://nodejs.org

---

### Where does Verdict store data?

**verdict.db** - SQLite database in your project directory.

This stores:
- Eval results
- Routing decisions
- Baselines
- Cached model responses

**Safe to delete** - it's just a cache. Verdict will recreate it.

---

### Can I version control Verdict config?

**Yes! Recommended setup:**

✅ **Check into Git:**
- `verdict.yaml` (config)
- `eval-packs/*.yaml` (test cases)
- `baselines/*.json` (optional - if you want team-shared baselines)

❌ **Don't check in:**
- `verdict.db` (local cache)
- API keys (use environment variables)

---

### How do I set up environment variables?

**In your shell:**
```bash
export OPENROUTER_KEY="sk-..."
export OPENAI_KEY="sk-..."
```

**In verdict.yaml:**
```yaml
models:
  - id: sonnet
    api_key: ${OPENROUTER_KEY}
```

**With defaults:**
```yaml
models:
  - id: local
    base_url: ${OLLAMA_HOST:-http://localhost:11434}
```

---

## Model Support

### Which models does Verdict support?

**Any OpenAI-compatible API**, including:

**Local:**
- Ollama (any model)
- MLX (Apple Silicon)
- LM Studio
- llama.cpp servers
- vLLM
- Text Generation Inference (TGI)

**Cloud:**
- OpenRouter (200+ models)
- OpenAI (GPT-4, GPT-4o, etc.)
- Anthropic (Claude)
- Groq (ultra-fast)
- Mistral
- Fireworks
- Together
- Any custom OpenAI-compat endpoint

**In short:** If it speaks OpenAI API, Verdict supports it.

---

### Can I test proprietary/closed models?

**Yes!** If they have an API (OpenAI-compatible), you can test them.

Examples:
- Your company's internal API
- Fine-tuned models on Replicate
- Custom endpoints

Just add to `verdict.yaml`:
```yaml
models:
  - id: my-model
    provider: openai
    model: custom-model-name
    base_url: https://your-api.com/v1
    api_key: ${YOUR_KEY}
```

---

### Do I need a GPU for local models?

**No, but it's much faster.**

**With GPU:**
- qwen2.5:7b generates ~50 tokens/sec
- Evals finish in minutes

**Without GPU (CPU only):**
- qwen2.5:7b generates ~5-10 tokens/sec
- Evals take longer but still work

**Recommendation:** Ollama works on CPU. It's slower, but functional.

---

### Can I test fine-tuned models?

**Yes!** Add them like any other model:

```yaml
models:
  - id: base-model
    provider: ollama
    model: qwen2.5:7b
  
  - id: my-finetuned
    provider: ollama
    model: my-finetuned:latest  # Your custom model
```

Then compare:
```bash
verdict run --models "base-model,my-finetuned"
```

---

### Can I test quantized models (2-bit, 4-bit)?

**Yes!** This is a common use case.

We even include a `quantization.yaml` eval pack (10 cases) specifically for testing quantization effects.

**Example:**
```yaml
models:
  - id: full-precision
    provider: ollama
    model: qwen2.5:7b
  
  - id: 4-bit
    provider: ollama
    model: qwen2.5:7b-q4
  
  - id: 2-bit
    provider: ollama
    model: qwen2.5:7b-q2
```

**Common finding:** 4-bit is usually fine, 2-bit often breaks tool-calling/JSON.

---

### Does Verdict work with Mixture-of-Experts (MoE) models?

**Yes!** Ollama auto-detects MoE models.

We include a `moe.yaml` eval pack (5 cases) for testing MoE-specific scenarios.

---

### Can I test models on remote servers?

**Yes!** Just point to the remote host:

```yaml
models:
  - id: remote-ollama
    provider: ollama
    model: qwen2.5:7b
    base_url: http://192.168.1.100:11434
  
  - id: remote-mlx
    provider: mlx
    model: Qwen2.5-7B-Instruct
    base_url: http://10.0.1.50:5000
```

---

## Judging & Scoring

### How does the judge work?

**The judge is an AI model that scores responses 1-10 based on your criteria.**

Think of it as automated peer review:

1. Test model generates response
2. Judge model reads:
   - The prompt
   - The response
   - Your judge criteria (what to look for)
3. Judge assigns score 1-10 with reasoning

---

### Can I use a local model as judge?

**Yes! Highly recommended.**

**Why:**
- Saves money (judge runs on every case)
- No API latency
- Works offline

**Which local model?**
- **qwen2.5:7b** - Excellent judge, free
- **mistral:7b** - Also good
- **llama3.2:3b** - Faster but less reliable

**Setup:**
```yaml
judge:
  model_id: qwen-7b  # Your local model
  temperature: 0.1
```

---

### How reliable are AI judges?

**Very reliable for objective tasks:**
- Code correctness ✅
- Logic/reasoning ✅
- Instruction-following ✅
- JSON validity ✅

**Less reliable for subjective tasks:**
- Creative writing ⚠️
- Personal preferences ⚠️
- Artistic style ⚠️

**Pro tip:** For structured outputs (JSON, exact matches), use deterministic judges instead of AI.

---

### What if the judge gives wrong scores?

**Solutions:**

1. **Improve judge criteria**
   ```yaml
   judge_criteria: |
     Score 1-10:
     • Correctness (40%): Does it work?
     • Quality (30%): Is code clean?
     • Completeness (20%): Edge cases?
     • Performance (10%): Efficient?
   ```

2. **Lower temperature** (more consistent)
   ```yaml
   judge:
     temperature: 0.1  # Was probably 0.7+
   ```

3. **Use smarter judge**
   ```yaml
   judge:
     model_id: sonnet  # More expensive but better
   ```

4. **Use deterministic judge** (for structured outputs)
   ```yaml
   cases:
     - prompt: "Output JSON: {\"status\": \"ok\"}"
       expected: '{"status": "ok"}'
       judge: json  # No AI, just validates JSON
   ```

---

### Can I use multiple judges?

**Yes (experimental)!**

```yaml
judge:
  mode: consensus
  judges:
    - model_id: qwen-7b
      weight: 1.0
    - model_id: sonnet
      weight: 1.5  # Trust sonnet more
    - model_id: haiku
      weight: 1.0
```

**Final score = weighted average of all judges.**

If judges disagree significantly (±2pts), Verdict flags it for manual review.

---

### What are deterministic judges?

**Code-based judges for exact matching:**

**json** - Validates JSON parsing
```yaml
judge: json
expected: '{"status": "ok"}'
```

**exact** - Exact string match
```yaml
judge: exact
expected: "SUCCESS"
```

**contains** - Substring match
```yaml
judge: contains
expected: "ERROR_"
```

**When to use:**
- Tool-calling (JSON validation)
- API responses (exact format)
- Structured outputs

**Benefits:**
- Free (no API calls)
- Fast (instant validation)
- Exact (no AI interpretation)

---

### Can I manually override judge scores?

**Not yet** - planned for v0.3.0.

**Current workaround:** Edit the JSON results file and re-run comparison.

---

## Eval Packs

### What's an eval pack?

**A YAML file containing test cases for your domain.**

Think of it as a test suite, but for AI models instead of code.

**Structure:**
```yaml
name: Your Domain
judge_criteria: "How to score responses"

cases:
  - prompt: "Task 1"
    expected_behavior: "What should happen"
  
  - prompt: "Task 2"
    context: "Additional info"
    expected_behavior: "Expected outcome"
```

---

### How many test cases do I need?

**Start small, iterate:**

- **10-15 cases** - Good starting point
- **25-50 cases** - Comprehensive coverage
- **100+ cases** - Production-grade benchmarking

**Quality > quantity.** 10 great cases beat 100 mediocre ones.

---

### Are there pre-built eval packs?

**Yes! 7 included (63 total cases):**

| Pack | Cases | Focus |
|------|-------|-------|
| `general.yaml` | 10 | General knowledge, reasoning |
| `coding.yaml` | 10 | Code generation, debugging |
| `reasoning.yaml` | 10 | Logic, math, planning |
| `instruction-following.yaml` | 10 | Following complex instructions |
| `writing-quality.yaml` | 8 | Creative writing, style |
| `moe.yaml` | 5 | Mixture-of-Experts routing |
| `quantization.yaml` | 10 | Quantization testing |

---

### Can I share eval packs with my team?

**Yes!** They're just YAML files.

**Recommended:**
```bash
# Check into Git
git add eval-packs/
git commit -m "Add customer-support eval pack"
git push
```

Now your whole team can run the same evals.

---

### How do I create a good eval pack?

**Best practices:**

1. **Use REAL tasks from your work**
   - ❌ Don't: "Write hello world"
   - ✅ Do: "Parse our customer CSV format"

2. **Make judge criteria measurable**
   - ❌ Don't: "Make it good"
   - ✅ Do: "Correctness (40%), Quality (30%), Performance (20%), Docs (10%)"

3. **Include edge cases**
   - Empty inputs
   - Unicode characters
   - Malformed data
   - Edge conditions

4. **Start small, iterate**
   - Begin with 10 cases
   - Add more as you discover gaps

5. **Document expected behavior**
   ```yaml
   - prompt: "Parse CSV with quotes"
     expected_behavior: |
       - Handles quoted fields
       - Commas in quoted fields don't split
       - Newlines in quotes preserved
       - Escapes handled correctly
   ```

---

### Can I test specific features like tool-calling?

**Yes!** Create a custom eval pack:

```yaml
# eval-packs/tool-calling.yaml
name: Tool Calling
cases:
  - prompt: "Search for: cats"
    expected: '{"tool": "search", "query": "cats"}'
    judge: json
  
  - prompt: "Calculate: 2 + 2"
    expected: '{"tool": "calculator", "expression": "2 + 2"}'
    judge: json
```

---

### Can I use context/few-shot examples in eval packs?

**Yes!**

```yaml
cases:
  - prompt: "Fix this bug"
    context: |
      Current code:
      ```python
      def add(a, b):
          return a + b + 1  # Bug here
      ```
      
      Expected: add(2, 3) should return 5
    expected_behavior: "Removes the +1, explains why it's wrong"
```

---

## Results & Interpretation

### What do the scores mean?

**1-10 scale:**

- **9-10:** Excellent (production-ready)
- **7-8:** Good (usable, minor issues)
- **5-6:** Mediocre (needs work)
- **3-4:** Poor (barely works)
- **1-2:** Failed (broken or wrong)

**Scores are normalized** so you can compare models directly.

---

### How do I know which model to choose?

**Verdict tells you!**

Look at the leaderboard:
```
[1] qwen2.5:7b   8.7/10  $0.00   ← Highest score, free
[2] sonnet       8.4/10  $0.15   ← Slightly lower, costs money
[3] llama3.2:3b  7.1/10  $0.00   ← Lowest score
```

**Decision tree:**

1. **Is the highest-scoring model free?**
   - Yes → Use it (easy choice)
   - No → Check cost-quality frontier

2. **Cost-quality frontier:**
   - "qwen2.5:7b matches sonnet within 0.3pts for FREE"
   - Is 0.3pts worth $50/month? (Usually no)

3. **Final decision:** Use qwen2.5:7b (high quality + free)

---

### What's the "cost-quality frontier"?

**Verdict automatically tells you if paying more actually gets you better results.**

**Example output:**
```
💡 qwen2.5:7b scores 8.9/10 for FREE
   sonnet scores 9.1/10 but costs $120/mo
   
   Difference: 0.2pts
   Your usage: ~500 prompts/month
   Annual cost: $1,440 for 0.2pt improvement
   
   Decision: Use qwen2.5:7b, save $1,440/year
```

**Translation:** Is a 0.2pt improvement worth $1,440? Usually not!

---

### Can I export results?

**Yes!** Results are automatically saved as JSON:

```bash
verdict run
# → Saves: verdict-results-2026-03-27-213045.json
```

**Compare two runs:**
```bash
verdict compare before.json after.json --output report.md
```

**Use in scripts:**
```bash
RESULTS=$(verdict run --output results.json)
# Parse results.json with jq/Python/etc.
```

---

### How do I track model performance over time?

**Use baselines:**

```bash
# 1. Save current as baseline
verdict run
verdict baseline save production-v1

# 2. Make changes (update model, quantize, etc.)

# 3. Compare to baseline
verdict run
verdict baseline compare production-v1
```

**Output:**
```
qwen2.5:7b: 8.5 → 8.9 (+0.4) ✅ Improved!
llama3.2:3b: 7.1 → 6.8 (-0.3) ⚠️  Regressed

Verdict: OK to deploy (net improvement)
```

---

### What if two models have the same score?

**Look at secondary factors:**

1. **Cost** - Prefer cheaper if scores are equal
2. **Speed** - Prefer faster if both are free
3. **Consistency** - Check per-case scores (one might be more consistent)
4. **Domain** - One might excel at specific tasks

**Example:**
```
[1] qwen2.5:7b   8.5/10  $0.00   850ms  ← Same score, but free + fast
[1] sonnet       8.5/10  $0.15  1200ms  ← Same score, but costs + slower

→ Choose qwen2.5:7b (no-brainer)
```

---

## Advanced Features

### How does the router work?

**The router automatically picks the best model for each task.**

**Process:**
1. **Classify task** - Is it code, reasoning, creative, tool-calling?
2. **Look up history** - Which model won for this task type? (from your eval results)
3. **Apply constraints** - Respect cost/speed limits you set
4. **Route** - Send task to best model

**Accuracy:** 60% out-of-box, improves to 75%+ as you run more evals.

---

### What's shadow mode?

**Safe A/B testing in production.**

**How it works:**
- Primary model serves users (as always)
- Shadow model runs in parallel (logged only)
- After N decisions, compare results
- If shadow is better, promote it

**Use cases:**
- Test new models without risk
- Validate routing changes
- Evaluate fine-tuned models

**Example:**
```typescript
const router = new VerdictRouter('./verdict.db', {
  shadowMode: true,
  primaryModel: 'qwen-7b',
  shadowModel: 'qwen-7b-tuned'
});

// After 1000 decisions:
const stats = router.getShadowStats();
if (stats.shadow.avgScore > stats.primary.avgScore + 0.2) {
  router.promoteShadowToPrimary();  // Safe to switch!
}
```

---

### Can I use Verdict to optimize prompts?

**Yes!**

**Create eval pack with prompt variations:**
```yaml
name: Prompt Optimization
cases:
  - prompt: "You are helpful. Reverse this string: hello"
    id: baseline
  
  - prompt: "You are an expert. Reverse this string: hello"
    id: variant-1
  
  - prompt: "Reverse this string: hello. Be precise."
    id: variant-2
```

**Run evals:**
```bash
verdict run --pack prompt-optimization
```

**Results:**
```
baseline:   7.2/10
variant-1:  8.1/10 (+0.9)  ← Best!
variant-2:  7.8/10 (+0.6)

→ Use variant-1 in production
```

---

### Can I use Verdict for model fine-tuning validation?

**Yes! Perfect use case.**

```bash
# Before fine-tuning
verdict run --models base-model
verdict baseline save before-finetuning

# After fine-tuning
verdict run --models finetuned-model
verdict baseline compare before-finetuning
```

**Results show:**
- Which tasks improved
- Which tasks regressed
- Overall quality change
- Whether fine-tuning was worth it

---

### Can I integrate Verdict into my app?

**Yes! Use the programmatic API:**

```typescript
import { VerdictRunner, VerdictRouter } from 'verdict';

// Run evals
const runner = new VerdictRunner('./verdict.yaml');
const results = await runner.run();

// Route tasks
const router = new VerdictRouter('./verdict.db');
const choice = await router.route("User prompt here");

// Use the best model
const response = await callModel(choice.model, prompt);
```

See [API.md](./API.md) for complete reference.

---

## Cost & Pricing

### How much does Verdict cost?

**Verdict itself is FREE (MIT open-source).**

**Runtime costs depend on your setup:**

| Setup | Cost |
|-------|------|
| All local models + local judge | $0.00 |
| Local models + cloud judge (haiku) | ~$0.50 per 100 cases |
| Cloud models + local judge | API costs only |
| Cloud models + cloud judge | API costs + judge costs |

---

### Can I run Verdict for $0?

**Yes!**

**Setup:**
```yaml
models:
  - id: qwen-7b
    provider: ollama
    model: qwen2.5:7b  # Free local model

judge:
  model_id: qwen-7b  # Use same local model as judge
```

**Result:** Run unlimited evals for $0.

---

### How much do cloud judges cost?

**Per 100 cases:**

| Judge | Cost | Speed | Quality |
|-------|------|-------|---------|
| **qwen2.5:7b (local)** | $0.00 | Fast | Good |
| **claude-haiku** | ~$0.50 | Fast | Great |
| **claude-sonnet** | ~$3.00 | Medium | Excellent |
| **gpt-4o** | ~$5.00 | Slow | Excellent |

**Recommendation:** Use local judge (qwen2.5:7b) for $0.

---

### How can I reduce costs?

**Strategies:**

1. **Use local judge**
   ```yaml
   judge:
     model_id: qwen-7b  # Free instead of $0.50+
   ```

2. **Fewer test cases** (start with 10-15, not 100)

3. **Shorter prompts** (costs scale with token count)

4. **Increase parallelism** (faster = less wasted time)
   ```yaml
   settings:
     parallel_requests: 5  # Default: 3
   ```

5. **Test fewer models** (focus on top candidates)

6. **Use OpenRouter** (often cheaper than direct APIs)

---

### What if I exceed my budget?

**Set cost limits:**

```yaml
settings:
  max_cost_per_run: 1.00  # Stop if exceeds $1
  warn_cost_threshold: 0.50  # Warn at $0.50
```

Verdict will stop execution if costs exceed your limit.

---

## Performance

### How long does a benchmark run take?

**Depends on:**
- Number of cases (10 = ~2 min, 100 = ~20 min)
- Number of models (3 models = 3x duration)
- Model speed (local = fast, cloud = medium)
- Parallelism (3 parallel = 3x faster)

**Typical:**
- 25 cases, 3 models, parallel execution → **3-5 minutes**

---

### How can I make Verdict faster?

**1. Increase parallelism**
```yaml
settings:
  parallel_requests: 5  # Default: 3
```

**2. Use faster models**
- Local models (Ollama/MLX) are faster than cloud
- Smaller models (3B) are faster than large (70B)

**3. Reduce test cases**
```bash
verdict run --pack general  # Quick 10-case sanity check
```

**4. Use fast cloud models**
- Groq (ultra-fast cloud inference)
- Mistral (fast API)

---

### Does Verdict cache results?

**Yes!** Responses are cached in `verdict.db`.

**First run:** 3 minutes (fresh API calls)  
**Second run:** 15 seconds (cache hits)

**Clear cache:**
```bash
rm verdict.db  # Verdict will recreate it
```

---

### Can I run evals in parallel?

**Yes, it's the default!**

```yaml
settings:
  parallel_requests: 3  # Run 3 at once
```

**Trade-off:**
- More parallel = faster
- More parallel = higher memory usage
- More parallel = harder to debug

---

## Troubleshooting

### Verdict says "command not found"?

**Cause:** Not in PATH or not installed globally.

**Fix:**
```bash
# Option 1: Use npx
npx verdict init

# Option 2: Fix PATH
echo 'export PATH="$PATH:$(npm config get prefix)/bin"' >> ~/.zshrc
source ~/.zshrc
```

---

### "No models configured" error?

**Cause:** Empty `verdict.yaml` or models section missing.

**Fix:**
```bash
verdict models discover  # Find local models
# Copy output to verdict.yaml
```

---

### "Model not found" error?

**Cause:** Model ID in config doesn't match available models.

**Fix:**
```bash
# Check configured models
cat verdict.yaml | grep "id:"

# Check available models
verdict models

# Make sure IDs match exactly
```

---

### My eval runs are timing out?

**Cause:** Model is slow or unresponsive.

**Fix:**
```yaml
settings:
  timeout_seconds: 60  # Increase from default 30
```

Or use a faster model.

---

### Judge keeps giving weird scores?

**Solutions:**

1. **Lower temperature**
   ```yaml
   judge:
     temperature: 0.1  # More consistent
   ```

2. **Improve criteria**
   ```yaml
   judge_criteria: |
     Be specific. Rate 1-10:
     • Correctness (does it work?)
     • Quality (is it clean?)
     • Completeness (edge cases?)
   ```

3. **Use smarter judge**
   ```yaml
   judge:
     model_id: sonnet  # Better but costs more
   ```

---

### Out of memory errors?

**Cause:** Too many parallel requests.

**Fix:**
```yaml
settings:
  parallel_requests: 1  # Reduce from 3
```

---

### Ollama connection failed?

**Cause:** Ollama server not running.

**Fix:**
```bash
# Start Ollama
ollama serve

# Or check status
curl http://localhost:11434/api/tags
```

---

### Can I debug what's happening?

**Yes!**

1. **Check model connectivity**
   ```bash
   verdict models  # Pings all configured models
   ```

2. **Dry run** (no API calls)
   ```bash
   verdict run --dry-run
   ```

3. **Check database**
   ```bash
   sqlite3 verdict.db "SELECT * FROM results LIMIT 5"
   ```

4. **Verbose mode** (coming in v0.3.0)

---

## Community & Support

### Is there a Discord?

**Yes!** [Join here](https://discord.gg/verdict)

**Channels:**
- `#help` - Get support
- `#show-and-tell` - Share your eval packs
- `#feature-requests` - Suggest improvements
- `#contributors` - Development discussion

---

### How do I report bugs?

**GitHub Issues:** https://github.com/yourusername/verdict/issues

**Include:**
- `verdict --version`
- Your `verdict.yaml` (redact API keys!)
- Full error message
- Steps to reproduce

---

### Can I request features?

**Yes!** Two ways:

1. **GitHub Discussions:** https://github.com/yourusername/verdict/discussions
2. **Discord:** `#feature-requests` channel

**Vote on existing requests to help us prioritize!**

---

### Is there a roadmap?

**Yes!** See [README.md#roadmap](./README.md#roadmap)

**Currently in progress:**
- Web UI dashboard
- Multi-judge consensus
- GitHub Action for CI/CD

**Vote on features in GitHub Discussions!**

---

### Can I contribute?

**Yes!** See [CONTRIBUTING.md](./CONTRIBUTING.md)

**Ways to help:**
- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve docs
- 🧪 Create eval pack templates
- 🔧 Add provider integrations
- 💻 Submit PRs

---

### Do you have office hours?

**Yes! Tuesdays 2-3pm PT**

[Add to calendar](https://cal.com/verdict)

Come ask questions, get help, or just chat about evals!

---

## Enterprise

### Is there enterprise support?

**Coming soon!**

**What we're planning:**
- Dedicated support channel
- SLA guarantees
- Custom integrations
- Team training
- Priority feature requests

**Interested?** Email: enterprise@verdict.dev

---

### Can I self-host Verdict?

**You already are!** Verdict runs entirely on your machine.

**No cloud dependency:**
- No data sent to Verdict servers (there aren't any!)
- Everything runs locally or via APIs you control
- Full data privacy

---

### Can we get custom features for our team?

**Yes!** We offer consulting.

**Services:**
- Custom provider integrations
- Domain-specific eval packs
- Custom judge development
- Team training
- Architecture consultation

**Contact:** consulting@verdict.dev

---

### Do you have SOC 2?

**N/A** - Verdict is a CLI tool that runs on your machine. There's no Verdict cloud service to audit.

**For your security team:**
- Verdict doesn't collect data
- Verdict doesn't send telemetry
- All data stays on your machine
- Source code is open (MIT license)

---

### Can we fork Verdict for internal use?

**Yes!** MIT license allows:
- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use

**You don't need permission** - just follow the MIT license terms.

---

**More questions?** Ask in [Discord](https://discord.gg/verdict) or [file an issue](https://github.com/yourusername/verdict/issues)!

---

**[⬆ Back to Top](#verdict-faq)**
