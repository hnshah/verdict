# Verdict Benchmark Analysis Template

**Run ID:** [AUTO]  
**Date:** [AUTO]  
**Models Tested:** [AUTO]  
**Cases:** [AUTO]  
**Judge:** [AUTO]

---

## Executive Summary

**Winner:** [MODEL] ([SCORE]/10)  
**Key Finding:** [ONE SENTENCE]  
**Surprise Result:** [UNEXPECTED FINDING]

---

## Model Rankings

| Rank | Model | Score | Accuracy | Completeness | Conciseness | Latency | Cost | Win% |
|------|-------|-------|----------|--------------|-------------|---------|------|------|
| 1 | [MODEL] | [X.X]/10 | [X.X] | [X.X] | [X.X] | [XX]s | [COST] | [XX]% |
| 2 | [MODEL] | [X.X]/10 | [X.X] | [X.X] | [X.X] | [XX]s | [COST] | [XX]% |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

---

## Size vs Performance Analysis

### Small Models (3-7B)
- **Best:** [MODEL] ([SCORE]/10)
- **Insight:** [OBSERVATION]
- **Use case:** [WHEN TO USE]

### Medium Models (12-14B)
- **Best:** [MODEL] ([SCORE]/10)
- **Insight:** [OBSERVATION]
- **Use case:** [WHEN TO USE]

### Large Models (20-32B)
- **Best:** [MODEL] ([SCORE]/10)
- **Insight:** [OBSERVATION]
- **Use case:** [WHEN TO USE]

### Massive Models (70B+)
- **Best:** [MODEL] ([SCORE]/10)
- **Insight:** [OBSERVATION]
- **Use case:** [WHEN TO USE]

### API Models
- **Best:** [MODEL] ([SCORE]/10)
- **Insight:** [OBSERVATION]
- **Cost/Quality:** [ANALYSIS]

---

## Performance Curves

### Quality vs Size
```
Does bigger = better?
- 3B → 7B: [+X.X] points
- 7B → 14B: [+X.X] points
- 14B → 32B: [+X.X] points
- 32B → 70B: [+X.X] points

Diminishing returns after: [SIZE]
```

### Speed vs Size
```
Latency penalty for size:
- 3B: [X]s avg
- 7B: [X]s avg
- 14B: [X]s avg
- 32B: [X]s avg
- 70B: [X]s avg

Sweet spot: [SIZE] ([REASON])
```

### Cost vs Quality
```
Best value models:
1. [MODEL]: [SCORE]/10 @ [COST]
2. [MODEL]: [SCORE]/10 @ [COST]
3. [MODEL]: [SCORE]/10 @ [COST]

Most expensive: [MODEL] @ [COST]
Cheapest: [MODEL] @ [COST]
Best bang/buck: [MODEL]
```

---

## Specialist vs Generalist

### Coding-Specialized Models
- **qwen2.5-coder-[SIZE]**: [SCORE]/10
- **qwen3-coder-[SIZE]**: [SCORE]/10
- **Advantage over base:** [+X.X] points
- **Worth it?** [YES/NO - REASON]

### Reasoning Models
- **deepseek-r1-[SIZE]**: [SCORE]/10
- **Advantage over base:** [+X.X] points
- **Worth it?** [YES/NO - REASON]

### General Models
- **qwen2.5-[SIZE]**: [SCORE]/10
- **qwen3-[SIZE]**: [SCORE]/10
- **llama3.x-[SIZE]**: [SCORE]/10

---

## Per-Task Analysis

### Task 1: [TASK NAME]
**Winner:** [MODEL] ([SCORE]/10)  
**Top 3:**
1. [MODEL]: [SCORE]/10 - [WHY IT WON]
2. [MODEL]: [SCORE]/10 - [WHY CLOSE]
3. [MODEL]: [SCORE]/10 - [WHY THIRD]

**Bottom 3:**
- [MODEL]: [SCORE]/10 - [WHY IT FAILED]

**Pattern:** [WHAT TYPE OF MODEL WINS THIS]

### Task 2: [TASK NAME]
[REPEAT]

### Task 3: [TASK NAME]
[REPEAT]

---

## Local vs API Comparison

### Quality
```
Haiku (API): [SCORE]/10
Best Local: [MODEL] ([SIZE]): [SCORE]/10
Gap: [X.X] points ([XX]%)

Sonnet (API): [SCORE]/10
Best Local: [MODEL] ([SIZE]): [SCORE]/10
Gap: [X.X] points ([XX]%)
```

### Speed
```
Haiku: [X]s avg
Best Local (speed): [MODEL]: [X]s avg

Haiku: [X]s avg
Best Local (quality): [MODEL]: [X]s avg
```

### Cost
```
Haiku: $[X] per eval
Local: $0.00 (electricity negligible)

Break-even: [X] evals per month
```

### Recommendation
**Use API when:** [SCENARIO]  
**Use Local when:** [SCENARIO]

---

## Surprising Findings

### 1. [SURPRISE]
- **Expected:** [EXPECTATION]
- **Actual:** [REALITY]
- **Explanation:** [HYPOTHESIS]

### 2. [SURPRISE]
- **Expected:** [EXPECTATION]
- **Actual:** [REALITY]
- **Explanation:** [HYPOTHESIS]

### 3. [SURPRISE]
[...]

---

## Model-Specific Insights

### [MODEL A]
- **Strengths:** [WHAT IT'S GOOD AT]
- **Weaknesses:** [WHAT IT STRUGGLES WITH]
- **Best for:** [USE CASE]
- **Avoid for:** [USE CASE]

### [MODEL B]
[REPEAT]

---

## Recommendations

### For Production
**Best choice:** [MODEL]  
**Reason:** [BALANCE OF QUALITY/SPEED/COST]  
**Runner-up:** [MODEL] ([WHY CONSIDER])

### For Development
**Best choice:** [MODEL]  
**Reason:** [FAST ITERATION]

### For Quality-Critical
**Best choice:** [MODEL]  
**Reason:** [HIGHEST QUALITY]

### For Cost-Sensitive
**Best choice:** [MODEL]  
**Reason:** [BEST VALUE]

---

## Actionable Insights

### 1. Size Selection
- **For [USE CASE]:** Use [SIZE] models
- **For [USE CASE]:** Use [SIZE] models
- **For [USE CASE]:** Use [SIZE] models

### 2. Specialist Selection
- **Coding tasks:** [MODEL TYPE] ([+X.X] points advantage)
- **Reasoning tasks:** [MODEL TYPE] ([+X.X] points advantage)
- **General tasks:** [MODEL TYPE] (baseline)

### 3. Infrastructure Decisions
- **VRAM needed for [SIZE]:** [XX]GB
- **Inference speed:** [X] tok/sec
- **Memory overhead:** [XX]GB
- **Concurrent users:** [X] per [SIZE]

---

## Future Tests

### Worth Testing Next
1. [HYPOTHESIS TO TEST]
2. [HYPOTHESIS TO TEST]
3. [HYPOTHESIS TO TEST]

### Questions Raised
1. [QUESTION]
2. [QUESTION]
3. [QUESTION]

---

## Raw Data

**Result file:** `[PATH]`  
**Leaderboard:** `[URL]`  
**Full report:** `[PATH]`

---

**Generated:** [TIMESTAMP]  
**Analyst:** Ren  
**Framework:** Verdict + Flow-Luck principles
