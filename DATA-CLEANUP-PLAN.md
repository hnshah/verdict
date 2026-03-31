# Verdict Dashboard - Data Quality Cleanup Plan

## Issues Found

### 1. Duplicate Model IDs (Naming Inconsistency)

**Problem:** Same model appears with different IDs due to naming variations
- `llama3.2:3b` vs `llama3.2-3b` (colon vs dash)
- `qwen2.5:7b` vs `qwen2.5-7b` (colon vs dash)

**Impact:**
- Model appears twice in leaderboard
- Stats split across two entries
- Confusing for users

**Solution:**
Standardize on **colon format** (matches Ollama naming):
- `llama3.2:3b` ✅
- `qwen2.5:7b` ✅
- `phi4:14b` ✅

### 2. "test-phi4" Model

**Problem:** Model ID "test-phi4" appears but shouldn't be a real model
- Likely a test run that shouldn't be in production data
- Causes confusion (shows qwen data on phi4 page)

**Solution:**
- Identify which run has "test-phi4"
- Check if it's a typo for "phi4" or "phi4:14b"
- Update or remove from dashboard-data.json

### 3. Run Names

**Some runs have good names:**
- ✅ "5 Models - 50 Cases"
- ✅ "Comprehensive Benchmark (10 models)"
- ✅ "3 Model Comparison - 10 cases"

**One run has unclear name:**
- ⚠️ "Verdict Auto-Dashboard" (run 2026-03-31T18-25-12)
  - Generic auto-generated name
  - Should be: "GSM8K Math Benchmark (5 models × 20 cases)"

### 4. Stale/Test Models

**These may be test data:**
- `cogito` - only 1 run, might be test
- `qwen-7b` vs `qwen2.5:7b` - which is correct?
- `qwen-32b` vs `qwen2.5:32b` - which is correct?
- `test-phi4` - obviously test data

## Cleanup Steps

### Phase 1: Consolidate Duplicate Models

**Action:** Update dashboard-data.json to use consistent naming

```bash
# Standardize to colon format
sed 's/"llama3.2-3b"/"llama3.2:3b"/g' dashboard-data.json
sed 's/"qwen2.5-7b"/"qwen2.5:7b"/g' dashboard-data.json
```

**Impact:**
- Model leaderboard: 21 models → ~18 models (after deduplication)
- Consolidated stats for each model

### Phase 2: Remove Test Data

**Identify test runs:**
1. Run with "test-phi4" model
2. Run with "cogito" model (if confirmed test)
3. Any runs with <5 cases (unless intentional)

**Action:**
- Remove test runs from dashboard-data.json
- Archive test run files to `archive/test-runs/`

### Phase 3: Improve Run Names

**Runs to rename:**

| Current Name | Better Name |
|--------------|-------------|
| Verdict Auto-Dashboard | GSM8K Math Benchmark (5 models) |
| test-phi4 - 10 cases | (Remove - test run) |

**Action:**
- Update run name in source JSON file
- Regenerate dashboard

### Phase 4: Standardize Model Naming

**Create model alias mapping:**

```json
{
  "aliases": {
    "llama3.2-3b": "llama3.2:3b",
    "qwen2.5-7b": "qwen2.5:7b",
    "qwen-7b": "qwen2.5:7b",
    "qwen-32b": "qwen2.5:32b",
    "test-phi4": null,  // Remove
    "cogito": null      // Remove if test
  }
}
```

## Expected Results

**Before Cleanup:**
- 21 models (with duplicates)
- 8 runs (some test data)
- Confusing model names
- Missing/wrong data in some columns

**After Cleanup:**
- ~15-16 real models (deduplicated)
- ~6-7 production runs (test data removed)
- Consistent naming (all use colons)
- Complete, accurate data in all columns

## Implementation

**Option 1: Manual Cleanup (Quick)**
1. Edit dashboard-data.json directly
2. Find/replace duplicates
3. Remove test entries
4. Regenerate dashboard

**Option 2: Automated Script (Proper)**
1. Create `clean-data.js` script
2. Applies all transformations
3. Validates output
4. Regenerates dashboard

**Recommendation:** Start with Option 1 (manual) to get clean dashboard live,
then build Option 2 (script) for future data imports.

## Next Steps

1. ✅ Audit complete (this document)
2. ⏳ Manual cleanup (next)
3. ⏳ Regenerate dashboard
4. ⏳ Verify all pages
5. ⏳ Deploy clean version
6. ⏳ Build automated cleanup script
7. ⏳ Document clean data standards

## Quality Standards Going Forward

**For all future runs:**
- ✅ Use consistent model IDs (colon format: `model:size`)
- ✅ Give runs descriptive names (not "My Evals" or "test")
- ✅ Minimum 5 test cases per run
- ✅ All cases must have valid IDs
- ✅ All responses must have scores
- ✅ No "test" or "temp" in production data
