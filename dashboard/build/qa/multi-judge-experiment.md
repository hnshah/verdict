# Multi-Model Judge Validation Experiment

## Goal
Test the same vision cases with different judge models to identify judge bias.

## Hypothesis
The phi4 judge is rewarding "helpfulness" over correctness in vision benchmarks, causing text-only models to score higher than vision models.

## Test Design

### Test Cases
Use 5 cases from the broken vision run (2026-04-01T03-19-27):
1. "Describe the scene in this image."
2. "What objects can you see in this picture?"
3. "What is the main subject of this image?"
4. "Describe the colors and lighting in this scene."
5. "What activity is taking place in this image?"

### Models to Test
- **Vision:** llava-13b
- **Text-only:** phi4

### Judge Models
Test with 4 different judges:
1. **phi4** (current - suspected biased)
2. **qwen2.5:7b** (general purpose)
3. **qwen3-coder:30b** (code-focused, larger)
4. **deepseek-r1:7b** (reasoning-focused)

## Expected Results

### If Judge is Unbiased (Expected)
All judges should consistently rank:
- llava-13b > phi4 (vision model should win)
- llava-13b scores: 7-10/10
- phi4 scores: 0-3/10 (cannot see images)

### If Judge is Biased (Current Behavior)
Some judges might rank:
- phi4 > llava-13b (rewarding "helpful" non-answers)
- phi4 scores: 6-10/10 (high despite being unable to see)
- llava-13b scores: 5-8/10 (penalized for style/conciseness)

## Metrics to Track

### Inter-Judge Agreement
- Kendall's Tau correlation between judge rankings
- Expected: τ > 0.8 for unbiased judges
- Current: τ < 0.5 if phi4 is outlier

### Scoring Patterns
For each judge, measure:
1. **Vision model average score** (should be high)
2. **Text-only model average score** (should be low)
3. **Non-answer reward rate** (% of non-answers scoring >5)
4. **Criteria weights** (accuracy vs completeness vs conciseness)

### Judge Classification
Label each judge:
- ✅ **Reliable:** Vision > Text-only consistently
- ⚠️ **Questionable:** Mixed results
- ❌ **Unreliable:** Text-only > Vision

## Implementation

### Step 1: Create Vision Test Pack
```yaml
# vision-judge-test.yaml
name: "Judge Reliability Test"
criteria:
  accuracy: 0.4
  completeness: 0.3
  conciseness: 0.3

cases:
  - id: scene-description
    prompt: "Describe the scene in this image."
    category: vision
    
  - id: object-detection
    prompt: "What objects can you see in this picture?"
    category: vision
    
  - id: main-subject
    prompt: "What is the main subject of this image?"
    category: vision
    
  - id: color-lighting
    prompt: "Describe the colors and lighting in this scene."
    category: vision
    
  - id: activity
    prompt: "What activity is taking place in this image?"
    category: vision
```

### Step 2: Run Evals with Each Judge
```bash
# Judge 1: phi4 (current)
verdict run \
  -c vision-config.yaml \
  --pack vision-judge-test.yaml \
  --judge phi4 \
  --models llava-13b,phi4

# Judge 2: qwen2.5:7b
verdict run \
  -c vision-config.yaml \
  --pack vision-judge-test.yaml \
  --judge qwen2.5:7b \
  --models llava-13b,phi4

# Judge 3: qwen3-coder:30b
verdict run \
  -c vision-config.yaml \
  --pack vision-judge-test.yaml \
  --judge qwen3-coder:30b \
  --models llava-13b,phi4

# Judge 4: deepseek-r1:7b
verdict run \
  -c vision-config.yaml \
  --pack vision-judge-test.yaml \
  --judge deepseek-r1:7b \
  --models llava-13b,phi4
```

### Step 3: Analyze Results
Create analyzer script: `qa/analyze-multi-judge.js`

## Success Criteria

### Experiment Succeeds If:
1. ✅ At least 3/4 judges agree (Kendall's τ > 0.8)
2. ✅ Majority ranks llava-13b > phi4
3. ✅ We identify which judge(s) are unreliable
4. ✅ We can recommend alternative judge models

### Experiment Fails If:
1. ❌ All judges are inconsistent (τ < 0.5)
2. ❌ No clear pattern emerges
3. ❌ All judges reward non-answers equally

## Next Steps After Results

### If phi4 is Confirmed Biased
1. Add warning to dashboard for runs using phi4 judge
2. Re-run all vision benchmarks with reliable judge
3. Update default judge in configs
4. Document judge selection guidelines

### If Multiple Judges are Biased
1. Investigate prompt engineering improvements
2. Test with different criteria weights
3. Consider custom judge training
4. Document vision eval best practices

### If All Judges Agree (Unexpected)
1. Verify original broken run data
2. Check if issue was temporary
3. Document as anomaly
4. Keep QA system for future detection

## Estimated Time
- Pack creation: 10 min
- Running 4 evals: 20 min (5 min each)
- Analysis script: 15 min
- Report generation: 10 min

**Total: ~55 minutes**

## Output Artifacts
1. `vision-judge-test.yaml` - Test pack
2. 4 result JSON files (one per judge)
3. `multi-judge-analysis.json` - Comparison data
4. `JUDGE-RELIABILITY-REPORT.md` - Findings + recommendations
