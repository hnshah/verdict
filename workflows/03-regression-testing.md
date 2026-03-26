# Regression Testing Workflow (15 minutes)

Catch model quality regressions before they hit production.

## The Problem

Models can regress when:
- Provider updates the model (GPT-4, Claude versions)
- You switch local model versions (Qwen 2.5 → 3.0)
- Quantization changes behavior (FP16 → Q4)
- Fine-tuning introduces unexpected side effects

**Without testing, you only notice when users complain!**

## The Solution: Baseline Comparison

Verdict lets you:
1. Save current performance as "baseline"
2. Run evals after changes
3. Compare new results to baseline
4. Detect regressions automatically

## Setup (One-Time)

### Step 1: Create Production-Like Eval Pack

```yaml
# eval-packs/production-scenarios.yaml
name: Production Scenarios
description: Real examples from production logs

cases:
  # Copy actual user requests
  - prompt: "Summarize this 3-page contract..."
    expected: Key terms, obligations, risks identified
    
  - prompt: "Debug this Python error: TypeError..."
    expected: Root cause + fix + explanation
    
  # Include edge cases you've seen
  - prompt: "What's 15% off $127.45 with 8.5% tax?"
    expected: Exact calculation, shows work
    
  # Add your toughest cases
  - prompt: "Explain quantum entanglement for a 10-year-old..."
    expected: Accurate, age-appropriate, uses analogy
```

**Pro tip:** Use real production data (anonymized)!

### Step 2: Run Initial Baseline

```bash
verdict run --packs production-scenarios
verdict baseline save v1.0 --description "Initial production baseline"
```

**Output:**
```
✓ Saved baseline: v1.0
  Model: qwen2.5:7b
  Score: 8.4/10
  Cases: 25
  Date:  2024-03-26
```

## Daily Workflow

### Before Deploying Changes

**Scenario:** You want to upgrade from qwen2.5:7b to qwen2.5:14b

```bash
# 1. Update verdict.yaml
vim verdict.yaml  # Change model to qwen2.5:14b

# 2. Run evals
verdict run --packs production-scenarios

# 3. Compare to baseline
verdict baseline compare v1.0
```

**Output shows regression:**
```
Comparing to baseline: v1.0

Models:
  qwen2.5:7b (baseline) → qwen2.5:14b (current)

Overall:
  Score: 8.4 → 8.9 (+0.5) ✓

By Pack:
  production-scenarios: 8.4 → 8.9 (+0.5) ✓
  
Top Improvements:
  [+2.0] "Explain quantum entanglement..." (6.0 → 8.0)
  [+1.5] "Summarize contract..." (7.5 → 9.0)

Top Regressions:
  [-0.5] "Calculate tax..." (9.0 → 8.5) ⚠️

Recommendation: UPGRADE ✓
  Significant improvement (+0.5) with minor regression in 1 case.
```

### When Regression Detected

**Scenario:** Score dropped from 8.4 → 7.9 (-0.5)

**Step 1: Investigate**
```bash
verdict compare baseline-v1.0.json current-results.json --detailed
```

**Output shows specific failures:**
```
Regressions (score dropped >1.0):

[1] "Debug Python error" (9.0 → 6.0, -3.0)
    Baseline: Correctly identified issue + fix
    Current:  Generic advice, missed root cause
    
[2] "Calculate tax" (9.0 → 7.0, -2.0)
    Baseline: Exact math, showed work
    Current:  Rounding error, incomplete
```

**Step 2: Fix or Rollback**

**Option A: Fix the prompt**
```yaml
# If new model needs different prompting
- prompt: |
    Debug this Python error (show exact root cause and fix):
    TypeError: cannot unpack non-iterable int object
```

**Option B: Rollback**
```bash
# If regression is unacceptable
git checkout HEAD~1 verdict.yaml
verdict run
verdict baseline compare v1.0  # Should match now
```

**Option C: Accept trade-off**
```bash
# If other improvements outweigh regression
verdict baseline save v1.1 --description "Upgraded to 14b, minor tax calc regression"
```

## Advanced: Automated Regression Testing

### GitHub Actions CI

```yaml
# .github/workflows/regression-test.yml
name: Model Regression Tests

on:
  pull_request:
    paths:
      - 'verdict.yaml'
      - 'eval-packs/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Ollama
        run: |
          curl -fsSL https://ollama.com/install.sh | sh
          ollama serve &
          ollama pull qwen2.5:7b
      
      - name: Install Verdict
        run: npm install -g verdict
      
      - name: Run Evals
        run: verdict run --packs production-scenarios
      
      - name: Compare to Baseline
        run: |
          verdict baseline compare v1.0
          if [ $? -ne 0 ]; then
            echo "❌ Regression detected!"
            exit 1
          fi
```

**Result:** PRs blocked if model quality drops!

### Cron Job (Daily Monitoring)

```bash
#!/bin/bash
# regression-check.sh

cd /opt/verdict

# Run evals
verdict run --packs production-scenarios --save results-$(date +%Y%m%d).json

# Compare to baseline
verdict baseline compare production-v1

if [ $? -ne 0 ]; then
  # Send alert
  curl -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $SLACK_TOKEN" \
    -d "text=⚠️ Model regression detected in production!"
fi
```

**Add to crontab:**
```bash
0 2 * * * /opt/verdict/regression-check.sh
```

**Result:** Catch regressions before users do!

## Best Practices

### 1. Version Your Baselines

```bash
verdict baseline save v1.0  # Initial
verdict baseline save v1.1  # After prompt improvements
verdict baseline save v2.0  # Major model upgrade
```

### 2. Test Multiple Dimensions

```bash
# Not just quality - also test:
verdict run --packs speed-test  # Latency matters
verdict run --packs safety-test # Avoid harmful outputs
verdict run --packs cost-test   # Token usage efficiency
```

### 3. Have Acceptance Criteria

```
Score drop >0.5:  Block deploy, investigate
Score drop 0.2-0.5: Review cases, decide
Score drop <0.2:  Accept (noise tolerance)
```

### 4. Update Baselines Regularly

```bash
# After major improvements, set new baseline
verdict baseline save v2.0 --description "New normal after optimizations"
```

## Troubleshooting

**"Baseline not found"**
- Run `verdict baseline list` to see saved baselines
- Create one: `verdict baseline save v1.0`

**"Can't compare different models"**
- Use `--force` flag: `verdict baseline compare v1.0 --force`
- Or compare results directly: `verdict compare old.json new.json`

**"Scores too volatile"**
- Increase `num_retries` in verdict.yaml
- Use deterministic judge settings
- Add more test cases (reduce variance)

---

**Result:** Ship model changes with confidence! 🛡️

Next: [Production Monitoring Workflow →](./04-production-monitoring.md)
