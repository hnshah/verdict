# Dashboard QA System

Comprehensive quality assurance system for the verdict eval dashboard.

## Overview

The QA system runs automatically after every dashboard generation and includes:

1. **Dashboard Validation** - Checks data integrity
2. **Scoring Sanity** - Detects illogical scoring patterns
3. **Judge Analysis** - Identifies judge biases
4. **Link Checker** - Validates all internal links

## Quick Start

### Run Full QA Suite

```bash
cd dashboard/build
npm run qa
```

This runs all 4 QA tools and generates a report.

### Run Individual Checks

```bash
# Dashboard validation (1,613 checks)
node qa/validate-dashboard.js

# Scoring sanity (vision benchmark detection)
node qa/check-scoring.js

# Judge behavior analysis
node qa/analyze-judge.js

# Link validation
node qa/check-links.js
```

### Generate QA Report

```bash
node qa/generate-report.js
```

Creates `QA-REPORT.md` with all findings.

## QA Tools

### 1. Dashboard Validator (`qa/validate-dashboard.js`)

**What it checks:**
- All JSON files are valid
- Required fields present (name, timestamp, run_id, cases, models, summary)
- Scores in valid range (0-10)
- No NaN or undefined scores
- Win rates add up correctly
- Judge reasoning exists for all scores
- Timestamps are valid
- Image paths exist (for vision evals)

**Example output:**
```
✅ 1613/1613 checks passed
🎉 All checks passed!
```

### 2. Scoring Sanity Checker (`qa/check-scoring.js`)

**What it detects:**
- Text-only models scoring high in vision benchmarks
- Vision models scoring unusually low
- Text-only models outscoring vision models
- "Helpful" non-answers being rewarded

**Known model types:**
- **Text-only:** phi4, qwen2.5, qwen-coder, llama3.2, etc.
- **Vision:** llava-13b, llama-vision-11b, qwen-vl

**Example output:**
```
❌ CRITICAL ISSUES (5):
  2026-04-01T03-19-27
  → Text-only model phi4 scored 8.51/10 in vision eval
  → phi4 (8.51) scored higher than llava-13b (8.02)
```

### 3. Judge Analyzer (`qa/analyze-judge.js`)

**What it analyzes:**
- Non-answer handling patterns
- Criteria weighting (accuracy vs completeness vs conciseness)
- Judge bias detection

**Example output:**
```
Non-Answer Handling:
  Rewards "helpful" non-answers (>5/10): 58.3%
  Penalizes non-answers (<5/10): 41.7%
  
⚠️ Judge favors helpfulness over correctness!

Criteria Weights:
  Accuracy:     0.74
  Completeness: 0.74
  Conciseness:  0.71
```

### 4. Link Checker (`qa/check-links.js`)

**What it validates:**
- All internal links resolve
- No 404s to runs/models
- Relative paths are correct

**Example output:**
```
Total Links Checked: 135
Files Checked: 53
✅ No broken links found!
```

## Unit Tests

Run Jest test suite:

```bash
cd dashboard/build
npm test
```

**Test coverage:**
- Vision scoring validation
- Model type detection
- Required fields validation
- Score range validation
- Judge reasoning validation

**Example output:**
```
Test Suites: 2 passed, 2 total
Tests:       19 passed, 19 total
```

## Auto-Fix Generator

Preview fixes before applying:

```bash
node qa/auto-fix.js
```

Apply fixes automatically:

```bash
node qa/auto-fix.js --apply
```

**Supported fixes:**
- Add warning banners to broken runs
- Add "Last updated" footers
- Fix broken links
- Flag biased judges

## Multi-Judge Validation

Test same cases with different judges to identify bias:

```bash
# See experiment design
cat qa/multi-judge-experiment.md

# Run experiment (requires verdict CLI)
# Creates 4 eval runs with different judges

# Analyze results
node qa/analyze-multi-judge.js result1.json result2.json result3.json result4.json
```

**Output:**
- Inter-judge agreement (Kendall's Tau)
- Judge reliability scores
- Outlier detection
- Recommendations

## Integration

### Manual Usage

```bash
cd dashboard/build
./generate-all.sh
```

QA runs automatically at the end.

### CI/CD Integration

```bash
# In GitHub Actions
- name: Generate Dashboard
  run: cd dashboard/build && ./generate-all.sh

- name: Check QA Results
  run: |
    if [ -f dashboard/build/QA-REPORT.md ]; then
      cat dashboard/build/QA-REPORT.md
    fi
```

### NPM Scripts

```json
{
  "scripts": {
    "build": "node build.js",
    "test": "jest qa/*.test.js",
    "qa": "node qa/validate-dashboard.js && node qa/check-scoring.js && node qa/analyze-judge.js && node qa/check-links.js",
    "qa:report": "node qa/generate-report.js"
  }
}
```

## Common Issues

### Vision Benchmark Scoring Problems

**Symptom:** Text-only model scores higher than vision model

**Cause:** Judge rewarding "helpful" non-answers over correct vision descriptions

**Fix:**
1. Add warning banner to run page
2. Re-run with different judge (qwen2.5:7b recommended)
3. Update judge selection guidelines

### Missing Judge Reasoning

**Symptom:** Warning about missing reasoning

**Cause:** Judge didn't generate reasoning for some scores

**Fix:** Check verdict config - ensure judge is properly configured

### Broken Links

**Symptom:** 404 errors in link checker

**Cause:** Run/model pages not generated or path mismatch

**Fix:** Regenerate dashboard with `./generate-all.sh`

## Best Practices

### For New Runs
1. Run QA checks after generation
2. Review QA-REPORT.md
3. Fix critical issues before publishing
4. Monitor judge behavior patterns

### For Vision Evals
1. Always use vision models in comparison
2. Verify judge doesn't reward non-answers
3. Consider multi-judge validation
4. Document expected score ranges

### For Judge Selection
1. Avoid phi4 for vision benchmarks (known bias)
2. Use qwen2.5:7b or qwen3-coder for general tasks
3. Test new judges with multi-judge validation
4. Track judge reliability over time

## Files

```
dashboard/build/qa/
├── validate-dashboard.js    # Main validator (1,613 checks)
├── check-scoring.js          # Scoring sanity checker
├── analyze-judge.js          # Judge behavior analyzer
├── check-links.js            # Link validator
├── auto-fix.js               # Auto-fix generator
├── generate-report.js        # QA report generator
├── analyze-multi-judge.js    # Multi-judge comparison
├── multi-judge-experiment.md # Experiment design doc
├── fixtures/                 # Test fixtures
│   ├── valid-run.json
│   ├── broken-vision-run.json
│   └── text-only-run.json
├── validate-dashboard.test.js # Unit tests
└── check-scoring.test.js     # Unit tests
```

## Metrics

- **Validation checks:** 1,613
- **Test coverage:** 19 unit tests
- **Link coverage:** 135+ links validated
- **Judge patterns:** 173 cases analyzed
- **Models tracked:** 24+

## Support

For issues or questions:
1. Check `QA-REPORT.md` for details
2. Review this documentation
3. Run individual tools for debugging
4. Check test fixtures for examples

---

**Last Updated:** 2026-03-31  
**Version:** 1.0  
**Status:** Operational ✅
