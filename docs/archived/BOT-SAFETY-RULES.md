# Bot Safety Rules - Prevent Data Loss

## 🚨 RULE #1: NEVER REBUILD FROM SCRATCH

**WRONG:**
```bash
# ❌ DON'T DO THIS - overwrites everything
cp dashboard-data.json.backup dashboard-data.json
./rebuild-all.sh
```

**RIGHT:**
```bash
# ✅ Always fetch latest first
git fetch origin
git pull origin main

# ✅ Then add your new data
```

---

## 🚨 RULE #2: ALWAYS ADD, NEVER REPLACE

### For New Eval Runs

**Use the additive workflow:**

```bash
# 1. Fetch latest
git pull origin main

# 2. Add your new run (this APPENDS, doesn't replace)
./scripts/add-run-to-dashboard.sh results/your-new-run.json

# 3. Verify you ADDED (didn't remove)
git diff dashboard-data.json | head -20

# Should see:
#   +  "total_runs": 13,    # OLD: 12
#   +  new run data...
# Should NOT see:
#   -  existing run data...
```

---

## 🚨 RULE #3: PRE-FLIGHT CHECKS

Before committing dashboard changes, run:

```bash
#!/bin/bash
# scripts/verify-dashboard-safety.sh

# Count runs BEFORE your changes
BEFORE=$(git show origin/main:dashboard-data.json | jq '.meta.total_runs')

# Count runs AFTER your changes  
AFTER=$(jq '.meta.total_runs' dashboard-data.json)

if [ "$AFTER" -lt "$BEFORE" ]; then
  echo "❌ DANGER! Run count decreased: $BEFORE → $AFTER"
  echo "You may have deleted data. Aborting."
  exit 1
fi

echo "✅ Safe: $BEFORE → $AFTER runs"
```

---

## 🚨 RULE #4: ATOMIC COMMITS

Each bot should commit:
1. Their new result JSON file ONLY
2. The updated dashboard-data.json
3. Nothing else

**Example:**
```bash
git add results/2026-04-01-my-new-eval.json
git add dashboard-data.json
git commit -m "feat: Add eval run 2026-04-01-my-new-eval"
git push origin main
```

**Don't commit:**
- Backup files
- Build artifacts  
- Temporary files

---

## 🚨 RULE #5: USE APPEND-ONLY SCRIPT

### Create: `scripts/add-run-safely.sh`

```bash
#!/bin/bash
set -e

NEW_RUN="$1"
if [ ! -f "$NEW_RUN" ]; then
  echo "Usage: $0 <path-to-new-run.json>"
  exit 1
fi

echo "=== SAFETY CHECKS ==="

# 1. Fetch latest
git fetch origin
git pull origin main --rebase

# 2. Backup current state
cp dashboard-data.json dashboard-data.json.pre-add

# 3. Count before
BEFORE=$(jq '.meta.total_runs' dashboard-data.json)
echo "Runs before: $BEFORE"

# 4. Add new run (merge, don't replace)
node scripts/merge-run.js "$NEW_RUN" dashboard-data.json

# 5. Count after
AFTER=$(jq '.meta.total_runs' dashboard-data.json)
echo "Runs after: $AFTER"

# 6. Verify we ADDED (not removed)
if [ "$AFTER" -le "$BEFORE" ]; then
  echo "❌ ERROR: No runs added! Reverting."
  mv dashboard-data.json.pre-add dashboard-data.json
  exit 1
fi

# 7. Show diff
echo ""
echo "=== CHANGES ==="
git diff dashboard-data.json | head -30

# 8. Confirm
read -p "Does this look safe? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted. Reverting."
  mv dashboard-data.json.pre-add dashboard-data.json
  exit 1
fi

# 9. Commit
git add dashboard-data.json results/
git commit -m "feat: Add evaluation run $(basename $NEW_RUN .json)"
git push origin main

echo "✅ Added safely!"
```

---

## 🚨 RULE #6: MERGE SCRIPT (Not Rebuild)

### Create: `scripts/merge-run.js`

```javascript
#!/usr/bin/env node
// Merge a new run INTO existing dashboard-data.json (ADDITIVE)

const fs = require('fs');

const newRunPath = process.argv[2];
const dashboardPath = process.argv[3] || './dashboard-data.json';

// Read existing dashboard
const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));

// Read new run
const newRun = JSON.parse(fs.readFileSync(newRunPath, 'utf8'));

console.log(`Merging ${newRun.name || newRun.run_id}...`);

// ADD cases (don't replace)
newRun.cases.forEach(newCase => {
  let existingCase = dashboard.cases.find(c => c.id === newCase.case_id);
  
  if (!existingCase) {
    // New case - add it
    dashboard.cases.push({
      id: newCase.case_id,
      name: newCase.case_id,
      prompt: newCase.prompt,
      criteria: newCase.criteria,
      runs: []
    });
    existingCase = dashboard.cases[dashboard.cases.length - 1];
  }
  
  // ADD this run's responses to the case
  existingCase.runs.push({
    run_id: newRun.run_id,
    responses: newCase.responses,
    // ... other run metadata
  });
});

// Update meta counts (INCREMENT, don't replace)
dashboard.meta.total_runs++;
dashboard.meta.total_cases = dashboard.cases.length;

// Update model list (MERGE, don't replace)
newRun.models.forEach(model => {
  if (!dashboard.models[model]) {
    dashboard.models[model] = {
      name: model,
      evaluations: 0,
      runs: []
    };
    dashboard.meta.total_models++;
  }
  dashboard.models[model].evaluations += newRun.cases.length;
  dashboard.models[model].runs.push(newRun.run_id);
});

// Write merged result
fs.writeFileSync(dashboardPath, JSON.stringify(dashboard, null, 2));

console.log(`✅ Merged! Now ${dashboard.meta.total_runs} runs.`);
```

---

## 🚨 RULE #7: CI CHECK

Add to `.github/workflows/verify-dashboard.yml`:

```yaml
name: Verify Dashboard Safety

on:
  pull_request:
    paths:
      - 'dashboard-data.json'

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 2
      
      - name: Check run count didn't decrease
        run: |
          BEFORE=$(git show HEAD^:dashboard-data.json | jq '.meta.total_runs')
          AFTER=$(jq '.meta.total_runs' dashboard-data.json)
          
          if [ "$AFTER" -lt "$BEFORE" ]; then
            echo "❌ ERROR: Runs decreased from $BEFORE to $AFTER"
            echo "This PR may have deleted data!"
            exit 1
          fi
          
          echo "✅ Safe: $BEFORE → $AFTER runs"
```

---

## 🚨 RULE #8: DOCUMENTATION

Update `BOT-HANDOFF-CHECKLIST.md` to reference these rules:

```markdown
## Before Adding Dashboard Data

1. Read `BOT-SAFETY-RULES.md`
2. Use `scripts/add-run-safely.sh` (NEVER rebuild from scratch)
3. Verify diff shows ADDITIONS only
4. Push and verify CI passes
```

---

## Summary: The Golden Rules

1. **NEVER** rebuild dashboard from backup
2. **ALWAYS** git pull before adding data
3. **ALWAYS** use append/merge (never replace)
4. **ALWAYS** verify count increased (never decreased)
5. **ALWAYS** use the safety scripts
6. **ALWAYS** commit atomically (one run = one commit)

**When in doubt:** Ask before pushing!

---

**This happened because:** No safety scripts existed, so manual rebuild seemed okay.

**This won't happen again because:** These rules + scripts enforce additive-only changes.
