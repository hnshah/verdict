# Verdict Feedback Response — All Features Implemented

**To:** verdict maintainer / production users  
**From:** Hiten Shah / verdict contributor  
**Date:** 2026-03-25

---

## Summary

All feedback from production use has been addressed. 8 PRs merged to main in one day:

- ✅ Critical bug (compiled build hanging) — **FIXED**
- ✅ High-priority features (vision, MCP, JSON schema) — **SHIPPED**
- ✅ Medium-priority (multi-turn, MoE evals) — **SHIPPED**
- ✅ Autonomous eval harness — **SHIPPED**

verdict is now production-ready for:
- CRO automation with vision analysis
- Agent eval with tool calling tests
- Structured output validation
- Context retention testing across quantization levels

---

## What was fixed

### Critical bug: compiled build hanging on Ollama

**Problem:** `node dist/cli/index.js run` hung indefinitely on Ollama calls. `npx tsx` worked fine.

**Root cause:** tsup bundled the `openai` SDK inline, breaking its `undici` HTTP client. `shims: true` also injected a conflicting fetch polyfill.

**Fix:** One line in `tsup.config.ts`:
```ts
external: ['openai'],  // load from node_modules at runtime
shims: false,          // don't inject fetch polyfill
```

**Status:** ✅ Merged (PR #4). Compiled binary works.

---

## High-priority features shipped

### #6 — Vision support

```yaml
- id: design-001
  prompt: "Score this homepage for CRO. Top 3 friction points?"
  image: ./screenshots/homepage-v1.png
  criteria: "Identifies CTA, above-fold, trust signals"
```

**What it does:**
- Accepts local PNG/JPG or URL
- Base64-encodes and sends as multipart content
- Works with Ollama vision models (llava, bakllava) and cloud (GPT-4o, Claude)
- Graceful fallback: non-vision models get a warning + text-only retry

**Status:** ✅ Merged (PR #10)

---

### #7 — MCP / tool calling eval

```yaml
- id: tool-001
  prompt: "Get weather in San Francisco"
  tools:
    - name: get_weather
      description: "Get weather for a city"
      parameters:
        type: object
        required: [city]
        properties:
          city: { type: string }
  scorer: tool_call
  expected_tool: get_weather
  expected_args:
    city: "San Francisco"
```

**What it does:**
- Passes tool definitions to model via OpenAI tools API
- Captures `tool_calls` from response
- Scores: no tool=0/10, wrong tool=2/10, correct tool+all args=10/10

**Status:** ✅ Merged (PR #10)

---

### #8 — JSON schema validation

```yaml
- id: extract-001
  prompt: "Extract name and price from: Blue widget, $12.99"
  scorer: jsonschema
  schema:
    type: object
    required: [name, price]
    properties:
      name: { type: string }
      price: { type: number }
  criteria: "Output must match schema"
```

**What it does:**
- Validates output shape, not just JSON.parse
- Partial credit: -2pts per missing required field, -1pt per wrong type
- No external dependencies (lightweight built-in checker)

**Status:** ✅ Merged (PR #10)

---

## Medium-priority features shipped

### #9 — Multi-turn conversations

```yaml
- id: context-001
  turns:
    - role: user
      content: "My name is Alex, building SaaS for lawyers."
    - role: assistant
      content: "__model__"   # runner replaces with actual response
    - role: user
      content: "What was my name and what am I building?"
  criteria: "Recalls Alex and SaaS for lawyers"
  scorer: contains
  expected: "Alex"
```

**What it does:**
- Send full conversation history
- `__model__` placeholders replaced with actual model responses
- Final response scored by any existing scorer (json, contains, exact, llm)
- Test context retention, instruction following across turns

**Status:** ✅ Merged (PR #10)

---

### Baseline tracking

```bash
verdict baseline save default     # save current result as baseline
verdict baseline list             # show all saved baselines
verdict baseline compare default  # show per-model score deltas
```

**What it does:**
- Tracks historical performance: V1 → V2 → V3
- Auto-compares against `default` baseline on every run
- 0.5pt regression triggers ⚠️ warning

**Status:** ✅ Merged (PR #4, autonomous eval harness)

---

### MoE eval pack redesign

**Problem:** The original `moe.yaml` had generic multi-domain tasks that any capable dense model would score equally on. No way to see MoE advantage.

**Fix:** Redesigned with 6 cases that require simultaneous multi-domain expertise:
- ML theory + neuroscience + code in one coherent answer
- Distributed systems + SQL + Byzantine fault tolerance + jazz theory
- Rust translation + memory safety + immunology analogy
- Code debugging + blood test diagnosis + structural pattern
- Full content moderation system (ML + legal + ops + adversarial)
- Rapid expert switching: cardiology + halting problem + options trading

**Also added:**
- MoE concurrency warnings (prevents memory pressure crashes)
- `verdict models discover` shows timeout + concurrency recommendations
- Routing hint: "MoE detected — run `verdict run --pack moe`"

**Status:** ✅ Merged (PR #5)

---

## Autonomous eval harness (bonus)

**Checkpoint / resume:**
```bash
verdict run --resume   # picks up where it left off after API timeout
```

**Synthesis agent:**
```bash
verdict run --question "Is sonar-pro worth 15x the cost?"
# Output includes plain-English recommendation with confidence
```

**Slack output:**
```yaml
output:
  formats: [json, markdown, slack]   # .slack-card.json for webhook posting
```

**Status:** ✅ Merged (PR #4)

---

## Already existed (users missed it)

These were requested but already in the codebase:

- ✅ **Cost tracking** — `total_cost_usd` per model in results JSON
- ✅ **Parallel execution** — `concurrency: 3` in run config (works today)
- ✅ **CI/CD GitHub Actions** — example in `docs/github-actions-example.md`

---

## What's NOT done (didn't request)

- No web UI / dashboard (out of scope for CLI tool)
- No streaming progress bar during runs (terminal reporter shows "Starting..." then final results)
- No automatic model discovery as part of scheduled runs (user runs `verdict models discover` manually)

---

## Testing

All features tested with:
- Ollama models (qwen2.5:7b, llama3.3:70b, llava for vision)
- Perplexity (sonar, sonar-pro)
- Local MLX on Apple Silicon
- Tool calling with simple get_weather function
- Multi-turn context retention cases

`npm run typecheck` passes clean. No breaking changes to existing eval packs.

---

## How to use the new features

### Vision evals
```bash
git pull origin main
npm install
npm run build

# Create a case with image: field
verdict run --pack ./my-vision-pack.yaml
```

### Tool calling evals
```yaml
# Add tools: and scorer: tool_call to any case
# verdict run works as normal
```

### Multi-turn context retention
```yaml
# Add turns: array instead of prompt: string
# Use __model__ placeholders
# verdict run works as normal
```

### JSON schema validation
```yaml
# Add scorer: jsonschema and schema: inline
# verdict run works as normal
```

---

## Bottom line

Every requested feature is live on main. Users can pull and start using vision, tool calling, schema validation, and multi-turn evals immediately.

The compiled build bug is fixed — no more tsx workaround needed.

MoE evals now actually test MoE advantages vs dense models.

verdict is production-ready for CRO automation, agent evals, structured output testing, and quantization impact analysis.

---

**Questions? Issues?** Open a GitHub issue or reply here.

**Want to contribute?** PRs welcome. The codebase is clean TypeScript, well-typed, and the sprint contract pattern makes features easy to specify and verify.
