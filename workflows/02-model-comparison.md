# Model Comparison Workflow (10 minutes)

Compare multiple models to find the best one for your use case.

## Use Case

You need to choose between:
- Local models (free, private, fast)
- Cloud models (expensive, high quality)

**Goal:** Find the sweet spot for your workload.

## Step 1: Add Models to Compare

Edit `verdict.yaml`:

```yaml
models:
  # Local: Qwen 2.5 series
  - id: qwen2.5:3b
    provider: ollama
  - id: qwen2.5:7b
    provider: ollama
  - id: qwen2.5:14b
    provider: ollama
  
  # Cloud: OpenAI
  - id: gpt-4o-mini
    provider: openai
    api_key: ${OPENAI_API_KEY}
  - id: gpt-4o
    provider: openai
    api_key: ${OPENAI_API_KEY}
  
  # Cloud: Anthropic
  - id: claude-haiku
    provider: anthropic
    api_key: ${ANTHROPIC_API_KEY}
  - id: claude-sonnet
    provider: anthropic
    api_key: ${ANTHROPIC_API_KEY}
```

## Step 2: Choose Relevant Eval Packs

For code generation:
```bash
verdict run --packs code-generation,reasoning
```

For customer support:
```bash
verdict run --packs customer-support,writing-quality
```

For data analysis:
```bash
verdict run --packs data-analysis,reasoning
```

## Step 3: Run Comparison

```bash
verdict run --save results-$(date +%Y%m%d).json
```

**Output:**
```
Models: 7 configured
Judge:  claude-haiku
Cases:  40 across 2 packs

[1] gpt-4o             ||||||||||  9.2  Best overall
[2] claude-sonnet      |||||||||.  9.1  Best reasoning
[3] qwen2.5:14b        ||||||||..  8.3  Best local
[4] gpt-4o-mini        ||||||||..  8.1  Fast + cheap
[5] qwen2.5:7b         |||||||...  7.8  Good value
[6] claude-haiku       |||||||...  7.5  Very fast
[7] qwen2.5:3b         ||||||....  6.4  Limited
```

## Step 4: Analyze Cost-Quality Tradeoffs

**Key questions:**

1. **Is the quality gap worth the cost?**
   - gpt-4o: 9.2/10, $0.50/1k tasks
   - qwen2.5:14b: 8.3/10, FREE
   - **Gap:** 0.9 points costs $600/year (at 1k tasks/day)

2. **Can local match cloud?**
   - qwen2.5:14b (8.3) vs gpt-4o-mini (8.1)
   - Local wins! No cost, more privacy

3. **When to use premium models?**
   - Critical tasks: Customer refunds, medical advice
   - Complex reasoning: Math proofs, code review
   - High stakes: Legal documents, financial analysis

## Step 5: Use Results to Decide

### Scenario A: Startup (Cost Sensitive)

**Decision:** qwen2.5:7b for everything, gpt-4o for critical tasks

**Routing strategy:**
```typescript
if (task.priority === 'critical') {
  return 'gpt-4o'  // 5% of tasks
} else {
  return 'qwen2.5:7b'  // 95% of tasks
}
```

**Cost:** ~$25/month (vs $500 all cloud)

### Scenario B: Enterprise (Quality First)

**Decision:** claude-sonnet default, local for bulk processing

**Routing strategy:**
```typescript
if (task.type === 'bulk_analysis') {
  return 'qwen2.5:14b'  // 40% of tasks
} else {
  return 'claude-sonnet'  // 60% of tasks
}
```

**Cost:** ~$2000/month (vs $3500 all cloud)

### Scenario C: Hybrid (Smart Routing)

**Decision:** Route by complexity

**Routing strategy:**
```typescript
const score = await estimateComplexity(task)

if (score > 8) return 'gpt-4o'        // 10% - complex
if (score > 5) return 'gpt-4o-mini'   // 30% - moderate
return 'qwen2.5:7b'                   // 60% - simple
```

**Cost:** ~$300/month + optimal quality

## Step 6: Save Baseline

```bash
verdict baseline save v1.0
```

Now you can detect regressions:

```bash
# After model update
verdict run
verdict baseline compare v1.0

> claude-sonnet: 9.1 → 8.8 (-0.3) ⚠️
```

## Pro Tips

**1. Test on YOUR data**
- Use custom eval packs with real examples
- Generic benchmarks don't capture edge cases

**2. Measure what matters**
- Don't optimize for score if latency matters
- Don't optimize for cost if quality matters

**3. Monitor in production**
- Run evals weekly on production data
- Catch model drift early

**4. A/B test routing decisions**
- Route 10% to new model
- Compare metrics before full switch

---

**Result:** Data-driven model selection, not guesswork! 📊

Next: [Regression Testing Workflow →](./03-regression-testing.md)
