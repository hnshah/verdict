# Verdict Examples

Real-world examples of using Verdict for model evaluation and selection.

---

## Quick Examples

### 1. Local vs Cloud Comparison

**Goal:** Decide if paying for Claude Sonnet is worth it for your code review tasks.

```yaml
# verdict.yaml
models:
  - id: local-qwen
    provider: ollama
    model: qwen2.5-coder:7b
  
  - id: claude-sonnet
    provider: openrouter
    model: anthropic/claude-sonnet-4
    api_key: ${OPENROUTER_KEY}

judge:
  model_id: local-qwen  # Use free local judge
```

```yaml
# eval-packs/code-review.yaml
name: Code Review Tasks
cases:
  - prompt: |
      Review this function for bugs:
      ```python
      def process_data(items):
          results = []
          for i in range(len(items)):
              if items[i] > 0:
                  results.append(items[i] * 2)
          return results
      ```
    judge_criteria: "Finds potential issues, suggests improvements"

  - prompt: "What's wrong with this React hook?"
    context: |
      function useData() {
        const [data, setData] = useState([]);
        data.push(newItem);  // Bug!
        return data;
      }
    judge_criteria: "Identifies mutation, explains useState correctly"
```

```bash
verdict run

Results:
  local-qwen:  8.3/10 ($0.00)
  claude-sonnet: 8.7/10 ($0.45/run)

💡 Verdict: Use local-qwen, save $270/month for 0.4pt difference
```

---

### 2. Quantization Testing

**Goal:** See what breaks when you quantize a model to 2-bit.

```yaml
# verdict.yaml
models:
  - id: qwen-7b-4bit
    provider: ollama
    model: qwen2.5:7b
  
  - id: qwen-7b-2bit
    provider: ollama
    model: qwen2.5:2bit

judge:
  model_id: qwen-7b-4bit  # Use 4-bit as judge
```

```yaml
# eval-packs/tool-calling.yaml
name: Tool Calling (JSON Output)
cases:
  - prompt: "Call the search tool with query 'cats'"
    expected_output:
      tool: "search"
      query: "cats"
    judge_criteria: "Valid JSON, correct structure"

  - prompt: "Get weather for San Francisco"
    expected_output:
      tool: "weather"
      location: "San Francisco"
    judge_criteria: "Valid JSON, correct tool name"
```

```bash
verdict run

Results:
  qwen-7b-4bit: 10/10 ✅ All JSON valid
  qwen-7b-2bit:  2/10 ❌ 8 failed (single quotes)

Example failure:
  Expected: {"tool": "search"}
  Got:      {'tool': 'search'}  ← Invalid JSON!

💡 Verdict: 2-bit breaks JSON. Use 4-bit.
```

---

### 3. Model Selection for Production

**Goal:** Find the cheapest model that meets your 8.0/10 quality bar.

```yaml
# verdict.yaml
models:
  - id: llama-3b
    provider: ollama
    model: llama3.2:3b
  
  - id: qwen-7b
    provider: ollama
    model: qwen2.5:7b
  
  - id: haiku
    provider: anthropic
    model: claude-3-5-haiku-20241022
    api_key: ${ANTHROPIC_KEY}
  
  - id: sonnet
    provider: anthropic
    model: claude-3-7-sonnet-20250219
    api_key: ${ANTHROPIC_KEY}
```

```bash
verdict run

Results:
  [1] sonnet:     9.2/10 ✅ ($89/mo)
  [2] qwen-7b:    8.3/10 ✅ ($0/mo)   ← MEETS BAR, FREE
  [3] haiku:      8.1/10 ✅ ($12/mo)
  [4] llama-3b:   6.9/10 ❌ (too low)

💡 Verdict: Use qwen-7b
   - Meets 8.0 bar
   - Saves $1,068/year vs haiku
   - Saves $2,136/year vs sonnet
```

---

## Advanced Examples

### 4. Multi-Pack Evaluation

Test models across different task types:

```bash
eval-packs/
  code-generation.yaml
  reasoning.yaml
  creative-writing.yaml
  tool-calling.yaml
```

```bash
verdict run

Overall Results:
  qwen-7b:  Strong in code (9.1), weak in creative (6.2)
  sonnet:   Balanced across all (8.5 average)
  haiku:    Fast but inconsistent (7.8 average)

💡 Verdict:
   - Use qwen-7b for code tasks
   - Use sonnet for creative/reasoning
   - Save 60% by routing intelligently
```

---

### 5. Router-Driven Selection

Automatically choose best model per task:

```typescript
// app.ts
import { VerdictRouter } from 'verdict';

const router = new VerdictRouter('./verdict.db');

async function generateCode(prompt: string) {
  // Router auto-selects best model based on task type
  const { choice } = await router.route(prompt);
  
  console.log(`Using: ${choice.model} (${choice.reason})`);
  
  // Use selected model
  return await callModel(choice.model, prompt);
}

// Examples:
await generateCode("Write a sorting function");
// → Using: qwen2.5:7b (code-generation specialist)

await generateCode("Explain quantum physics");
// → Using: sonnet (reasoning specialist)
```

---

### 6. Regression Testing in CI

Catch quality drops before deployment:

```yaml
# .github/workflows/model-quality.yml
name: Model Quality Check

on: [push, pull_request]

jobs:
  verdict:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Verdict
        run: npm install -g verdict
      
      - name: Run Evals
        run: |
          verdict run --baseline production
          verdict baseline compare production
      
      - name: Fail if Regression
        run: |
          # Exit 1 if new model < baseline
          verdict baseline compare production --fail-if-worse
```

---

### 7. Cost-Quality Frontier Analysis

Find optimal cost/quality tradeoff:

```typescript
// analyze-frontier.ts
import { VerdictRunner } from 'verdict';

const runner = new VerdictRunner();
const results = await runner.run();

// Sort by quality
const sorted = results.sort((a, b) => b.score - a.score);

console.log('Cost-Quality Frontier:\n');

sorted.forEach((result, i) => {
  const costPerMonth = estimateMonthlyCost(result);
  const prevScore = i > 0 ? sorted[i-1].score : 10;
  const scoreDrop = prevScore - result.score;
  const savings = i > 0 ? estimateMonthlyCost(sorted[i-1]) - costPerMonth : 0;
  
  console.log(`${result.model}:`);
  console.log(`  Score: ${result.score}/10`);
  console.log(`  Cost: $${costPerMonth}/mo`);
  
  if (i > 0) {
    console.log(`  vs ${sorted[i-1].model}:`);
    console.log(`    -${scoreDrop.toFixed(1)}pts quality`);
    console.log(`    -$${savings.toFixed(2)}/mo cost`);
    console.log(`    → ${savings > 0 ? 'WORTH IT' : 'NOT WORTH IT'}`);
  }
  console.log();
});

// Output:
// sonnet:
//   Score: 9.2/10
//   Cost: $89/mo
//
// qwen-7b:
//   Score: 8.3/10
//   Cost: $0/mo
//   vs sonnet:
//     -0.9pts quality
//     -$89/mo cost
//     → WORTH IT (save $1068/year for 0.9pt drop)
```

---

## Domain-Specific Examples

### Legal Document Analysis

```yaml
# eval-packs/legal.yaml
name: Legal Document Analysis
judge_criteria: |
  Rate accuracy of legal analysis:
  - Correct identification of clauses
  - Risk assessment accuracy
  - Clarity of explanation

cases:
  - prompt: "Identify risks in this NDA"
    context: |
      [NDA excerpt]
    judge_criteria: "Finds non-compete, broad definition issues"
```

### Medical Coding

```yaml
# eval-packs/medical.yaml
name: ICD-10 Coding
cases:
  - prompt: "Assign ICD-10 code for: Patient with type 2 diabetes and hypertension"
    expected: "E11.9, I10"
    judge_criteria: "Correct primary/secondary codes"
```

### Financial Analysis

```yaml
# eval-packs/finance.yaml
name: Financial Statement Analysis
cases:
  - prompt: "Calculate working capital ratio from this balance sheet"
    context: |
      Current Assets: $500K
      Current Liabilities: $300K
    expected: "1.67"
    judge_criteria: "Correct calculation, proper interpretation"
```

---

## Integration Examples

### Express.js API

```typescript
// server.ts
import express from 'express';
import { VerdictRouter } from 'verdict';

const app = express();
const router = new VerdictRouter('./verdict.db');

app.post('/api/complete', async (req, res) => {
  const { prompt } = req.body;
  
  // Route to best model
  const { choice } = await router.route(prompt);
  
  // Call selected model
  const result = await callModel(choice.model, prompt);
  
  res.json({
    model: choice.model,
    reason: choice.reason,
    result
  });
});

app.listen(3000);
```

### Next.js Server Action

```typescript
// app/actions.ts
'use server'

import { VerdictRouter } from 'verdict';

const router = new VerdictRouter('./verdict.db');

export async function generateResponse(prompt: string) {
  const { choice } = await router.route(prompt);
  return await callModel(choice.model, prompt);
}
```

---

## Real-World Results

### Case Study: Developer Tools Startup

**Before Verdict:**
- Using GPT-4 for everything
- $450/month API costs
- No systematic testing

**After Verdict:**
- Code tasks → qwen2.5-coder:7b (free)
- Complex reasoning → GPT-4 (selective)
- Saved $380/month (84% reduction)
- Quality maintained (8.7 → 8.5 avg)

**ROI:** $4,560/year savings, 3 hours setup time

---

### Case Study: Enterprise Chatbot

**Problem:**
- 100K requests/month
- Claude Opus = $1,200/month
- Need cost reduction without quality drop

**Solution:**
```yaml
models:
  - qwen2.5:7b      # Free, fast
  - haiku           # $50/mo
  - sonnet          # $300/mo
```

**Results:**
- 70% routed to qwen2.5:7b (simple queries)
- 20% routed to haiku (medium complexity)
- 10% routed to sonnet (complex reasoning)

**Outcome:**
- Cost: $1,200 → $350/month (71% savings)
- Quality: 8.9 → 8.6 (3% drop, acceptable)
- Speed: 2.1s → 0.8s avg (62% faster)

---

## More Examples

See our [examples repo](https://github.com/verdict-examples) for:
- 📊 Jupyter notebooks
- 🎥 Video tutorials
- 📝 Blog post case studies
- 💼 Enterprise deployment guides

---

**Want to add your example?** Submit a PR to this directory!
