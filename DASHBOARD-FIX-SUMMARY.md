# Dashboard Auto-Regeneration Fix - COMPLETE ✅

**Date:** 2026-03-31  
**Time:** 08:25 - 08:57 PT

---

## Problem Discovered

**Auto-contribute worked, but dashboard didn't update!**

```
✅ verdict run → result JSON saved
✅ Auto-contribute → JSON uploaded to dashboard/published/
✅ GitHub Action triggered
✅ dashboard-data.json regenerated
❌ index.html NOT regenerated
❌ Dashboard showed stale data
```

---

## Root Causes (Two Issues Fixed!)

### Issue #1: Workflow Used Wrong Command

**Problem:**
```yaml
# Old workflow
node dist/cli/index.js dashboard generate \
  --results dashboard/published \
  --output dashboard/published/dashboard-data.json
```

**This only generates JSON, not HTML!**

**Fix:**
```yaml
# New workflow
node dist/cli/index.js dashboard deploy \
  --to github-pages \
  --results dashboard/published \
  --output dashboard/published
```

**This generates BOTH index.html + dashboard-data.json!**

### Issue #2: ESM __dirname Not Defined

**Problem:**
```typescript
// dashboard.ts (line 573)
path.resolve(__dirname, '../../../dashboard/templates', filename)
// ❌ __dirname doesn't exist in ES modules!
```

**Error in GitHub Action:**
```
ReferenceError: __dirname is not defined
```

**Fix:**
```typescript
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
```

---

## Fixes Applied

### Commit 1: Workflow Update
```
🔧 fix: Regenerate dashboard HTML on auto-contribute

Changed:
- dashboard generate → dashboard deploy
- Added --to github-pages
- Updated file_pattern to include index.html
- Commit message now includes source commit
```

### Commit 2: ESM Compatibility
```
🔧 fix: ESM compatibility for dashboard deploy command

Added:
- import { fileURLToPath } from 'url'
- const __filename = fileURLToPath(import.meta.url)
- const __dirname = path.dirname(__filename)
```

---

## Verification

### ✅ Build Test
```bash
npm run build
# ✅ Success

verdict dashboard deploy --results dashboard/published --output /tmp/test
# ✅ Generated both index.html + dashboard-data.json
```

### ✅ GitHub Action Test
```
Workflow run #23806629397:
- Regenerate Dashboard: ✅ success
- Deploy Dashboard to GitHub Pages: ✅ success
```

**Output:**
```
Regenerating dashboard from 4 result files...
✔ Dashboard generated
✓ Dashboard files written to: dashboard/published
✅ Dashboard regenerated (index.html + dashboard-data.json)
```

---

## How It Works Now

### Complete Auto-Contribute Flow

**Step 1: Eval Run**
```bash
verdict run
# → Results saved to results/YYYY-MM-DD-timestamp.json
```

**Step 2: Auto-Contribute** (if enabled in config)
```typescript
if (config.settings?.auto_contribute) {
  await contributeCommand(result)
  // → Uploads to dashboard/published/YYYY-MM-DD-timestamp.json
}
```

**Step 3: GitHub Action Triggered**
```yaml
on:
  push:
    paths:
      - 'dashboard/published/*.json'
```

**Step 4: Regenerate Dashboard**
```bash
verdict dashboard deploy \
  --to github-pages \
  --results dashboard/published \
  --output dashboard/published

# Reads ALL result files
# Aggregates into dashboard-data.json
# Generates index.html with embedded data
```

**Step 5: Commit Updated Files**
```yaml
file_pattern: "dashboard/published/index.html dashboard/published/dashboard-data.json"
# Bot commits both files
```

**Step 6: Deploy to GitHub Pages**
```yaml
- name: Upload artifact
  path: 'dashboard/published'
  
- name: Deploy to GitHub Pages
  uses: actions/deploy-pages@v4
```

**Step 7: Dashboard Live!**
- GitHub Pages serves updated index.html
- New run appears on dashboard
- All old runs preserved (additive!)

---

## Testing Required

**To fully validate, need to:**
1. Run a new eval (not just trigger regeneration)
2. Auto-contribute uploads new result
3. Workflow regenerates with NEW data
4. Bot commits index.html + dashboard-data.json
5. GitHub Pages deploys
6. Dashboard shows new run

**Why test triggering didn't work:**
- We re-saved existing file (no new data)
- Regeneration ran successfully
- Output was identical to existing files
- git-auto-commit found no changes
- Nothing committed (expected behavior!)

---

## Files Changed

```
.github/workflows/regenerate-dashboard.yml  (workflow fix)
src/cli/commands/dashboard.ts               (ESM fix)
```

---

## Impact

**Before:**
- Auto-contribute uploads JSON ✅
- Dashboard data regenerates ✅
- Dashboard HTML stays stale ❌
- **Manual step required** ❌

**After:**
- Auto-contribute uploads JSON ✅
- Dashboard data regenerates ✅
- Dashboard HTML regenerates ✅
- GitHub Pages deploys ✅
- **Fully automated!** ✅

---

## Learnings

### 1. Test End-to-End User Experience
- We tested file upload ✅
- We tested action trigger ✅
- We tested JSON regeneration ✅
- We didn't test HTML visibility ❌
- **Always test what users actually see!**

### 2. Aggregation Pattern Works
```typescript
// dashboard deploy aggregates ALL files
const files = fs.readdirSync(resultsDir)
  .filter(f => f.endsWith('.json') && f !== 'dashboard-data.json')

for (const file of files) {
  // Process each result
  // Append to cases
  dashCase.runs.push(run)  // ← Additive, not replacement!
}
```

### 3. ESM vs CommonJS Gotchas
- __dirname doesn't exist in ES modules
- Use import.meta.url instead
- TypeScript can hide these (only fail at runtime)

### 4. GitHub Actions Auto-Commit Behavior
- Only commits CHANGED files
- Empty commits are skipped
- Expected behavior (prevents noise)

---

## Status

✅ **Feature Complete**  
✅ **Workflow Fixed**  
✅ **ESM Issue Fixed**  
✅ **Locally Tested**  
✅ **GitHub Action Tested**  
⏳ **Awaiting Real Eval Run** (full E2E test)

---

**Next:** Run a real eval to validate complete flow!

