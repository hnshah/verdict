# Verdict Dashboard QA Skill

Comprehensive quality assurance for the Verdict evaluation dashboard.

## When to Use

Use this skill when:
- User asks to "check the dashboard" or "QA the dashboard"
- Before deploying dashboard changes
- After adding new evaluation runs
- When investigating data quality issues
- User reports broken pages or missing data

## What This Skill Does

1. **Validates Data Integrity**
   - Checks dashboard-data.json structure
   - Verifies all runs have complete case data
   - Ensures no duplicate models
   - Validates model name consistency

2. **Validates All Pages**
   - Main dashboard exists and renders
   - All model pages exist and have data
   - All run pages exist and have data
   - All links work (no 404s)

3. **Validates Content Quality**
   - No "Unnamed Run" entries
   - No blank data fields (%, null, 0 where inappropriate)
   - All tables have headers and data
   - All Hugging Face links present

4. **Generates QA Report**
   - Summary of errors and warnings
   - Specific pages with issues
   - Data quality metrics
   - Recommendations for fixes

## How to Use

### Basic QA Check

```bash
cd /path/to/verdict-fork
./qa-dashboard.sh
```

### Full QA with Link Validation

```bash
cd /path/to/verdict-fork
./skills/qa-verdict-dashboard/full-qa.sh
```

### Data Quality Only

```bash
cd /path/to/verdict-fork
./skills/qa-verdict-dashboard/check-data.sh
```

## QA Checklist

### Critical (Must Pass)

- [ ] dashboard-data.json exists and is valid JSON
- [ ] Main dashboard (index.html) exists and >10KB
- [ ] All model pages exist (one per model in dashboard-data.json)
- [ ] All run pages exist (one per run in dashboard-data.json)
- [ ] No broken internal links

### Important (Should Pass)

- [ ] No "Unnamed Run" entries
- [ ] No duplicate models (llama3.2:3b vs llama3.2-3b)
- [ ] All model pages have HF links
- [ ] All data fields populated (no %, null, or 0/10 scores)
- [ ] Run names are descriptive

### Nice to Have

- [ ] Performance history charts present
- [ ] Best/worst cases shown on model pages
- [ ] Mobile responsive
- [ ] Page load <2s

## Files

```
skills/qa-verdict-dashboard/
├── SKILL.md                 # This file
├── full-qa.sh               # Complete QA suite
├── check-data.sh            # Data quality checks
├── check-links.sh           # Link validation
├── check-pages.sh           # Page existence/content
└── generate-report.sh       # Generate HTML QA report
```

## Common Issues & Fixes

### Issue: "Unnamed Run" in model pages

**Cause:** Model extractor not loading run names from individual JSON files

**Fix:**
```bash
cd dashboard/build
# Rebuild model pages with correct extractor
./rebuild-models.sh
```

### Issue: Model pages blank or missing data

**Cause:** Extractor reading wrong data source

**Fix:**
```bash
cd dashboard/build
# Use model-from-data.js (reads dashboard-data.json)
node extractors/model-from-data.js "phi4:14b" ../../dashboard-data.json
```

### Issue: Run page 404

**Cause:** Run page not built or wrong directory name

**Fix:**
```bash
cd dashboard/build
# Rebuild all run pages
./rebuild-runs.sh
```

### Issue: Duplicate models in leaderboard

**Cause:** Inconsistent naming (colon vs dash)

**Fix:**
```bash
# Run data cleanup
node clean-data.cjs
# Regenerate dashboard
cd dashboard/build && npm run build-all
```

## Automation

### Pre-Deployment Check

Add to CI/CD:

```yaml
# .github/workflows/qa-dashboard.yml
name: QA Dashboard
on: [push, pull_request]

jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: QA Dashboard
        run: |
          cd verdict-fork
          ./qa-dashboard.sh
          if [ $? -ne 0 ]; then
            echo "Dashboard QA failed"
            exit 1
          fi
```

### Post-Run Auto-QA

After adding a new run:

```bash
#!/bin/bash
# add-run-with-qa.sh
set -e

RUN_FILE=$1

# Add run
./add-run.sh "$RUN_FILE"

# QA check
./qa-dashboard.sh

# If QA fails, rollback
if [ $? -ne 0 ]; then
  echo "QA failed, rolling back..."
  git reset --hard HEAD~1
  exit 1
fi

echo "✅ Run added and QA passed"
```

## QA Report Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERDICT DASHBOARD QA REPORT
Generated: 2026-03-31 12:35 PDT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DATA INTEGRITY: ✅ PASS
   - dashboard-data.json: Valid
   - Total runs: 8
   - Total models: 15
   - Total cases: 80
   - No duplicates found

2. PAGE VALIDATION: ⚠️  1 WARNING
   ✅ Main dashboard: OK (20.4 KB)
   ✅ Model pages: 15/15 OK
   ⚠️  Run pages: 8/9 (missing 2026-03-31T18-25-12)

3. CONTENT QUALITY: ✅ PASS
   ✅ No "Unnamed Run" entries
   ✅ All HF links present
   ✅ All data fields populated
   
4. LINK VALIDATION: ✅ PASS
   - Internal links: 127/127 OK
   - External links: 15/15 OK (HF)

SUMMARY: 1 warning, 0 errors
STATUS: READY TO DEPLOY ✅

Fix: Rebuild run page 2026-03-31T18-25-12
```

## Next Steps After QA

If QA passes:
1. Commit changes
2. Push to GitHub
3. Verify live site in ~2 minutes

If QA fails:
1. Review error details
2. Apply fixes from "Common Issues" section
3. Re-run QA
4. Deploy only after all checks pass

## Integration with Verdict CLI

Future: Integrate into verdict CLI

```bash
# Proposed commands
verdict dashboard qa                    # Run QA
verdict dashboard qa --fix              # Auto-fix common issues
verdict dashboard qa --report report.html  # Generate HTML report
```
