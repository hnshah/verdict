# Testing Guide

How to test the verdict dashboard QA system.

## Quick Test

Run all tests:

```bash
cd dashboard/build
npm test
```

Expected output:
```
Test Suites: 2 passed, 2 total
Tests:       19 passed, 19 total
```

## Unit Tests

### Test Suites

1. **Scoring Validation** (`qa/check-scoring.test.js`)
   - Vision case detection
   - Model type identification
   - Broken scoring detection

2. **Dashboard Validation** (`qa/validate-dashboard.test.js`)
   - Required fields
   - Score ranges
   - Judge reasoning
   - Timestamps

### Running Specific Tests

```bash
# Run only scoring tests
npm test -- qa/check-scoring.test.js

# Run only validation tests
npm test -- qa/validate-dashboard.test.js

# Watch mode (auto-rerun on changes)
npm run test:watch
```

### Test Fixtures

Located in `qa/fixtures/`:

**valid-run.json** - Clean run with all required fields
```json
{
  "name": "Valid Test Run",
  "timestamp": "2026-03-31T20:00:00Z",
  "models": ["qwen2.5:7b", "llama3.2:3b"],
  "cases": [...],
  "summary": {...}
}
```

**broken-vision-run.json** - Text-only model beating vision model
```json
{
  "models": ["phi4", "llava-13b"],
  "cases": [{ "prompt": "Describe the scene in this image." }],
  "summary": {
    "phi4": { "avg_total": 8.5 },      // ❌ Too high!
    "llava-13b": { "avg_total": 8.0 }  // ❌ Lower than text-only!
  }
}
```

**text-only-run.json** - Normal coding benchmark
```json
{
  "models": ["qwen-coder", "phi4"],
  "cases": [{ "prompt": "Write a Python function..." }]
}
```

## Manual Testing

### Test Dashboard Validator

```bash
node qa/validate-dashboard.js
```

Should output:
```
✅ 1613/1613 checks passed
🎉 All checks passed!
```

### Test Scoring Checker

```bash
node qa/check-scoring.js
```

Should detect 5 critical issues in existing data.

### Test Judge Analyzer

```bash
node qa/analyze-judge.js
```

Should show judge behavior patterns.

### Test Link Checker

```bash
node qa/check-links.js
```

Should validate 135+ links with 0 broken.

## Integration Testing

### Test Full Build + QA

```bash
cd dashboard/build
./generate-all.sh
```

Expected workflow:
1. Generate dashboard pages ✅
2. Generate run pages (13) ✅
3. Generate model pages (24) ✅
4. Run QA checks ✅
5. Generate QA report ✅

Check output:
```bash
cat QA-REPORT.md
```

### Test QA Suite

```bash
npm run qa
```

Runs all 4 QA tools sequentially.

## Testing New Features

### Add New Test Case

1. Create fixture:
```bash
cat > qa/fixtures/my-test-run.json << 'EOF'
{
  "name": "My Test",
  "timestamp": "2026-03-31T20:00:00Z",
  ...
}
EOF
```

2. Import in test:
```javascript
const myTestRun = require('./fixtures/my-test-run.json');
```

3. Write test:
```javascript
test('should detect my issue', () => {
  const result = validateSomething(myTestRun);
  expect(result.valid).toBe(false);
});
```

4. Run:
```bash
npm test
```

### Test Auto-Fix

```bash
# Dry run (preview)
node qa/auto-fix.js

# Actually apply
node qa/auto-fix.js --apply
```

### Test Multi-Judge

```bash
# With mock data
node qa/analyze-multi-judge.js

# With real results
node qa/analyze-multi-judge.js result1.json result2.json result3.json
```

## Debugging Tests

### Verbose Output

```bash
# Jest verbose mode
npm test -- --verbose

# Individual tool debug
node qa/validate-dashboard.js 2>&1 | tee debug.log
```

### Check Test Coverage

```bash
npm test -- --coverage
```

### Isolate Failing Test

```bash
# Run single test
npm test -- -t "should detect broken scoring"

# Run single file
npm test qa/check-scoring.test.js
```

## Performance Testing

### Measure QA Speed

```bash
time npm run qa
```

Typical times:
- Dashboard validation: ~0.5s
- Scoring checker: ~0.3s
- Judge analyzer: ~0.2s
- Link checker: ~1.0s
- **Total:** ~2 seconds

### Load Testing

Create large fixture:
```javascript
const largRun = {
  ...validRun,
  cases: Array(1000).fill(validRun.cases[0])
};
```

## CI/CD Testing

### GitHub Actions Example

```yaml
name: QA Dashboard

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install dependencies
        run: cd dashboard/build && npm install
      
      - name: Run unit tests
        run: cd dashboard/build && npm test
      
      - name: Run QA suite
        run: cd dashboard/build && npm run qa
      
      - name: Upload QA report
        uses: actions/upload-artifact@v2
        with:
          name: qa-report
          path: dashboard/build/QA-REPORT.md
```

## Common Test Failures

### "Cannot find module"

**Cause:** Missing fixture or incorrect path

**Fix:**
```bash
# Check fixture exists
ls qa/fixtures/

# Check import path
grep -n "require.*fixtures" qa/*.test.js
```

### "Expected false, received true"

**Cause:** Test assertion logic inverted

**Fix:** Check if validation should pass or fail for this case

### "Module not found" during QA

**Cause:** Running from wrong directory

**Fix:**
```bash
cd dashboard/build
npm run qa
```

## Best Practices

### Writing Tests

1. **Use descriptive names**
   ```javascript
   test('should detect text-only models in vision evals', () => {
     // Clear what's being tested
   });
   ```

2. **Test one thing per test**
   ```javascript
   // ✅ Good
   test('should detect NaN scores', () => { ... });
   test('should detect out-of-range scores', () => { ... });
   
   // ❌ Bad
   test('should validate scores', () => {
     // Tests NaN AND range AND reasoning
   });
   ```

3. **Use fixtures, not inline data**
   ```javascript
   // ✅ Good
   const run = require('./fixtures/valid-run.json');
   
   // ❌ Bad
   const run = { name: "test", ... }; // 50 lines
   ```

### Maintaining Tests

1. Update fixtures when schema changes
2. Add tests for new QA rules
3. Keep test runtime < 1 second
4. Document complex assertions

## Troubleshooting

### Tests pass locally but fail in CI

**Check:**
- Node version matches
- All fixtures committed
- Paths are relative, not absolute

### Jest warnings about open handles

**Fix:** Add at top of test file:
```javascript
afterAll(() => {
  // Clean up any open handles
});
```

### False positives in scoring checker

**Adjust:** Model type lists in `check-scoring.js`

---

**Last Updated:** 2026-03-31  
**Test Coverage:** 19 unit tests  
**Status:** All passing ✅
