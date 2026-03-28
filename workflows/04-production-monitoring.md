# Production Monitoring Workflow (20 minutes)

Monitor model quality in production and catch issues early.

## Why Monitor?

Models can drift over time:
- Provider changes models without notice
- Usage patterns evolve (different from training)
- Edge cases accumulate
- Costs increase unexpectedly

**Monitoring catches these before they become incidents.**

## Architecture

```
Production App
      ↓
  [Log Requests] → S3/Database
      ↓
  [Daily Cron Job]
      ↓
  verdict run --from-logs
      ↓
  [Compare to Baseline]
      ↓
  Alert if regression
```

## Setup

### Step 1: Log Production Requests

```typescript
// In your production app
import { writeFile } from 'fs/promises'

async function callLLM(prompt: string) {
  const response = await model.generate(prompt)
  
  // Log for later analysis
  await logRequest({
    timestamp: new Date().toISOString(),
    prompt,
    response: response.text,
    model: 'qwen2.5:7b',
    latency_ms: response.latency,
    tokens: response.tokens,
  })
  
  return response
}

async function logRequest(data: any) {
  const date = new Date().toISOString().split('T')[0]
  const logPath = `/var/log/llm/${date}.jsonl`
  await writeFile(logPath, JSON.stringify(data) + '\n', { flag: 'a' })
}
```

### Step 2: Sample Logs for Eval

```bash
#!/bin/bash
# sample-logs.sh - Run daily

DATE=$(date +%Y-%m-%d)
LOG_FILE="/var/log/llm/${DATE}.jsonl"

# Sample 100 random requests
shuf -n 100 $LOG_FILE > /tmp/sample-${DATE}.jsonl

# Convert to eval pack format
python3 convert-logs-to-eval.py /tmp/sample-${DATE}.jsonl > eval-packs/production-${DATE}.yaml
```

**convert-logs-to-eval.py:**
```python
import sys
import json
import yaml

def convert_logs(log_file):
    cases = []
    
    with open(log_file) as f:
        for line in f:
            data = json.loads(line)
            cases.append({
                'prompt': data['prompt'],
                'expected': data['response'],  # Use actual response as expected
                'tags': [data['model']],
            })
    
    return {
        'name': f'Production Sample {log_file}',
        'description': 'Random sample from production traffic',
        'cases': cases
    }

if __name__ == '__main__':
    log_file = sys.argv[1]
    eval_pack = convert_logs(log_file)
    print(yaml.dump(eval_pack))
```

### Step 3: Run Daily Evals

```bash
#!/bin/bash
# monitor.sh - Cron: 0 2 * * *

DATE=$(date +%Y-%m-%d)

# Sample and convert logs
./sample-logs.sh

# Run evals on sampled production data
verdict run --packs production-${DATE} --save results-${DATE}.json

# Compare to baseline
verdict baseline compare production-baseline > comparison-${DATE}.txt

# Check for regressions
if grep -q "REGRESSION" comparison-${DATE}.txt; then
    # Send alert
    ./send-alert.sh "⚠️ Model regression detected on ${DATE}"
    
    # Attach comparison
    cat comparison-${DATE}.txt | ./send-to-slack.sh
fi

# Update metrics dashboard
python3 update-metrics.py results-${DATE}.json
```

## Metrics to Track

### 1. Quality Score Over Time

```bash
# Extract scores from daily results
for file in results-*.json; do
    date=$(echo $file | grep -oP '\d{4}-\d{2}-\d{2}')
    score=$(jq '.summary.mean_score' $file)
    echo "$date,$score"
done > quality-trend.csv
```

**Plot in Grafana/Datadog:**
- X-axis: Date
- Y-axis: Mean quality score
- Alert if drops >0.5 for 2 consecutive days

### 2. Cost Trend

```bash
# Track daily costs
for file in results-*.json; do
    date=$(echo $file | grep -oP '\d{4}-\d{2}-\d{2}')
    cost=$(jq '.summary.total_cost_usd' $file)
    echo "$date,$cost"
done > cost-trend.csv
```

**Alert if:**
- Daily cost >$50 (unexpected spike)
- Weekly cost +20% vs previous week

### 3. Latency Percentiles

```bash
# P50, P95, P99 latency
jq '[.results[].latency_ms] | sort | 
    {p50: .[length/2], 
     p95: .[length*0.95], 
     p99: .[length*0.99]}' results-today.json
```

**Alert if:**
- P95 latency >2x baseline
- P99 latency >5x baseline

### 4. Failure Rate

```bash
# Count errors/timeouts
jq '[.results[] | select(.error != null)] | length' results-today.json
```

**Alert if:**
- Failure rate >5%
- Sudden spike (2x previous day)

## Dashboard Setup

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "LLM Production Monitoring",
    "panels": [
      {
        "title": "Quality Score (7-day rolling average)",
        "targets": [
          {
            "expr": "avg_over_time(llm_quality_score[7d])"
          }
        ]
      },
      {
        "title": "Daily Cost",
        "targets": [
          {
            "expr": "sum(llm_cost_usd) by (model)"
          }
        ]
      },
      {
        "title": "P95 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, llm_latency_ms)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(llm_errors_total[5m])"
          }
        ]
      }
    ]
  }
}
```

### Alert Rules

```yaml
# alerts.yaml
groups:
  - name: llm_quality
    rules:
      - alert: QualityRegression
        expr: llm_quality_score < 7.5
        for: 2d
        annotations:
          summary: "Model quality dropped below threshold"
          
      - alert: CostSpike
        expr: increase(llm_cost_usd[1d]) > 50
        annotations:
          summary: "Daily LLM costs exceeded $50"
          
      - alert: LatencyHigh
        expr: histogram_quantile(0.95, llm_latency_ms) > 5000
        for: 10m
        annotations:
          summary: "P95 latency >5s for 10 minutes"
          
      - alert: HighErrorRate
        expr: rate(llm_errors_total[5m]) > 0.05
        annotations:
          summary: "Error rate >5%"
```

## Advanced: A/B Testing in Production

### Gradual Rollout

```typescript
// Route 10% of traffic to new model
function selectModel(userId: string): string {
  const hash = hashUserId(userId)
  
  if (hash % 100 < 10) {
    return 'qwen2.5:14b'  // 10% - new model
  } else {
    return 'qwen2.5:7b'   // 90% - current model
  }
}
```

### Compare Results

```bash
# After 1 week, compare metrics

# Old model (90% of traffic)
cat logs-week1.jsonl | grep 'qwen2.5:7b' > logs-7b.jsonl
verdict run --from-logs logs-7b.jsonl

# New model (10% of traffic)
cat logs-week1.jsonl | grep 'qwen2.5:14b' > logs-14b.jsonl
verdict run --from-logs logs-14b.jsonl

# Compare
verdict compare results-7b.json results-14b.json
```

**Decision criteria:**
```
If new_model_score > old_model_score + 0.3:
    → Increase to 50%
    
If new_model_score < old_model_score - 0.3:
    → Rollback to 0%
    
Else:
    → Keep at 10%, collect more data
```

## Incident Response

### When Alert Fires

**1. Triage (5 min)**
```bash
# Check recent results
verdict run --packs production-latest
verdict baseline compare production-baseline --detailed

# Identify which cases regressed
grep "REGRESSED" comparison-latest.txt
```

**2. Investigate (15 min)**

**Check provider:**
- Did OpenAI/Anthropic update models?
- Check their status page/changelog

**Check usage:**
- Did request patterns change?
- New edge cases in logs?

**Check config:**
- Did someone modify verdict.yaml?
- Temperature/parameters changed?

**3. Mitigate (30 min)**

**Option A: Rollback**
```bash
# Revert to previous model version
git checkout HEAD~1 verdict.yaml
deploy-model.sh
```

**Option B: Adjust prompts**
```bash
# If new model needs different prompting
update-system-prompt.sh
verdict run  # Verify fix
```

**Option C: Route around**
```bash
# Route affected traffic to backup model
update-routing-rules.sh --avoid qwen2.5:14b --fallback gpt-4o-mini
```

**4. Post-Mortem**
- Document what happened
- Update monitoring/alerts
- Add test case to prevent recurrence

## Best Practices

### 1. Separate Monitoring from Prod Evals

```
Production evals:  Full test suite (slow, thorough)
Monitoring evals:  Sampled traffic (fast, continuous)
```

### 2. Version Everything

```bash
# Git commit every baseline/config change
git commit -m "Updated baseline after prompt optimization"
git tag production-v2.0
```

### 3. Maintain Golden Set

Keep 100 hand-verified "perfect" examples:
```yaml
# eval-packs/golden-set.yaml
name: Golden Set
description: Hand-verified perfect examples

cases:
  - prompt: "What's 2+2?"
    expected: "4"
    verified: true
    verified_by: "human-reviewer"
    verified_at: "2024-03-26"
```

Run golden set daily - never should regress!

### 4. Monitor Judge Quality Too

```bash
# Judge might drift/fail
verdict run --judge-test
```

If judge fails, alerts are meaningless!

---

**Result:** Catch issues in hours, not days! 🚨

Next: [Advanced Routing Strategies →](./05-advanced-routing.md) (coming soon)
