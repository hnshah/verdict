# Verdict Complete Workflow

**Complete end-to-end guide for running evals and updating the dashboard.**

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Running Evaluations](#running-evaluations)
3. [Dashboard Generation](#dashboard-generation)
4. [Current Dashboard System](#current-dashboard-system)
5. [Unified Workflow](#unified-workflow)
6. [Automation](#automation)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Directory Structure

```
verdict/
├── src/                        # TypeScript source
│   ├── cli/                    # CLI commands
│   │   ├── commands/
│   │   │   ├── dashboard.ts    # Dashboard generation (TypeScript)
│   │   │   └── run.ts          # Run evals command
│   ├── core/                   # Core eval engine
│   ├── providers/              # Model providers (Ollama, MLX, OpenAI, etc.)
│   └── types/                  # TypeScript types
│
├── eval-packs/                 # Test case definitions (YAML)
│   ├── code-generation.yaml
│   ├── debugging.yaml
│   └── information-extraction.yaml
│
├── results/                    # Raw eval output (JSON)
│   └── 2026-03-31-2026-03-31T14-25-37.json
│
├── dashboard/                  # Dashboard system (SEPARATE from verdict CLI)
│   ├── build/                  # Node.js build scripts
│   │   ├── extractors/         # Data extractors
│   │   │   ├── dashboard-from-data.js   # Main dashboard extractor
│   │   │   ├── model-from-data.js       # Model page extractor
│   │   │   └── run.js                    # Run page extractor
│   │   ├── templates/          # Liquid templates
│   │   │   ├── dashboard.html
│   │   │   ├── model.html
│   │   │   └── run.html
│   │   └── build.js            # Template renderer
│   └── published/              # Generated static HTML
│       ├── index.html
│       ├── data/               # Individual run files (copied from results/)
│       ├── models/             # Model detail pages
│       └── runs/               # Run detail pages
│
├── dashboard-data.json         # Aggregated dashboard data (ROOT LEVEL)
├── clean-data.cjs              # Data cleanup script
└── regenerate-dashboard-data.sh # Regenerate from individual files
```

### Dashboard System

**Dashboard Build System** - Node.js
- Location: `dashboard/build/`
- Purpose: Multi-page static site generator
- Output: Full site with model/run detail pages
- Deployment: GitHub Pages (https://hnshah.github.io/verdict/)

**Note:** The built-in `verdict dashboard` CLI command has been **removed** to avoid confusion. The custom build system in `dashboard/build/` is the only dashboard system.

---

## Running Evaluations

### 1. Create/Edit Eval Pack

Eval packs are YAML files in `eval-packs/`:

```yaml
# eval-packs/my-test.yaml
name: My Test
description: Testing my models
models:
  - ollama:qwen2.5:7b
  - ollama:phi4:14b
cases:
  - case_id: test-001
    prompt: "Write hello world in Python"
    criteria: "Must be valid Python code"
  - case_id: test-002
    prompt: "Explain recursion"
    criteria: "Clear, accurate explanation"
```

### 2. Run the Eval

```bash
cd /path/to/verdict

# Run specific eval pack
npx verdict run --eval-pack eval-packs/my-test.yaml

# Run with specific models
npx verdict run --eval-pack eval-packs/my-test.yaml --models ollama:phi4,ollama:qwen2.5:7b

# Run all eval packs
npx verdict run --all
```

### 3. Results Saved to `results/`

Output file: `results/2026-03-31-2026-03-31T14-25-37.json`

Structure:
```json
{
  "name": "My Test",
  "run_id": "2026-03-31T14-25-37",
  "timestamp": "2026-03-31T14:29:10.668Z",
  "models": ["ollama:qwen2.5:7b", "ollama:phi4:14b"],
  "cases": [
    {
      "case_id": "test-001",
      "prompt": "...",
      "responses": {
        "ollama:qwen2.5:7b": {
          "text": "print('hello world')",
          "latency_ms": 1234
        }
      },
      "scores": {
        "ollama:qwen2.5:7b": {
          "total": 9.5,
          "reasoning": "...",
          "dimensions": {
            "accuracy": 10,
            "completeness": 9,
            "conciseness": 9
          }
        }
      },
      "winner": "ollama:qwen2.5:7b"
    }
  ]
}
```

---

## Dashboard Generation

### Current System (Custom Build)

**Location:** `dashboard/build/`

This is a **standalone static site generator** that:
1. Reads individual run files from `dashboard/published/data/`
2. Aggregates into `dashboard-data.json`
3. Generates HTML pages from Liquid templates
4. Outputs to `dashboard/published/` for GitHub Pages

### Step-by-Step Process

#### 1. Copy New Run to Dashboard Data Directory

```bash
cp results/2026-03-31-2026-03-31T14-25-37.json \
   dashboard/published/data/
```

#### 2. Regenerate Dashboard Data

```bash
./regenerate-dashboard-data.sh
```

This script:
- Scans `dashboard/published/data/*.json`
- Aggregates all runs into `dashboard-data.json`
- Runs `clean-data.cjs` to normalize model names

#### 3. Generate Dashboard Pages

```bash
cd dashboard/build

# Generate main dashboard
node extractors/dashboard-from-data.js ../../dashboard-data.json > data/dashboard.json
node build.js data/dashboard.json --template templates/dashboard.html
cp output/dashboard/index.html ../published/index.html

# Generate all model pages
jq -r '.models | keys[]' ../../dashboard-data.json | while read model; do
  safe_name=$(echo "$model" | sed 's/[:]/-/g; s/[.]/-/g')
  node extractors/model-from-data.js "$model" ../../dashboard-data.json > "data/model-temp.json"
  node build.js "data/model-temp.json" --template templates/model.html
  mkdir -p "../published/models/$safe_name"
  cp "output/model-temp/index.html" "../published/models/$safe_name/"
done

# Generate all run pages
for f in ../../dashboard/published/data/2026-*.json; do
  run_id=$(basename "$f" .json | sed 's/2026-03-31-//')
  node extractors/run.js "$f" > "data/run-temp.json"
  node build.js "data/run-temp.json" --template templates/run.html
  mkdir -p "../published/runs/$run_id"
  cp "output/run-temp/index.html" "../published/runs/$run_id/"
done
```

#### 4. Deploy to GitHub Pages

```bash
git add dashboard-data.json dashboard/
git commit -m "feat: Add new evaluation run"
git push origin main
```

GitHub Pages auto-deploys from `dashboard/published/` → https://hnshah.github.io/verdict/

---

## Current Dashboard System

### Data Flow

```
results/*.json
    ↓ (copy)
dashboard/published/data/*.json
    ↓ (regenerate-dashboard-data.sh)
dashboard-data.json (root)
    ↓ (clean-data.cjs)
dashboard-data.json (cleaned)
    ↓ (extractors)
dashboard/build/data/*.json
    ↓ (build.js + templates)
dashboard/published/*.html
    ↓ (git push)
GitHub Pages
```

### Key Files

| File | Purpose |
|------|---------|
| `dashboard-data.json` | Master aggregated data (root level) |
| `clean-data.cjs` | Normalize model names, remove duplicates |
| `regenerate-dashboard-data.sh` | Rebuild dashboard-data.json from run files |
| `dashboard/build/extractors/dashboard-from-data.js` | Extract dashboard page data |
| `dashboard/build/extractors/model-from-data.js` | Extract model page data |
| `dashboard/build/extractors/run.js` | Extract run page data |
| `dashboard/build/build.js` | Render Liquid templates to HTML |
| `audit-data.sh` | Validate dashboard data quality |
| `skills/qa-verdict-dashboard/full-qa.sh` | Pre-deploy QA checks |

---

## Unified Workflow

### Quick Add Run (Recommended)

```bash
#!/bin/bash
# quick-add-run.sh - Add a new run and update dashboard

RUN_FILE=$1

if [ ! -f "$RUN_FILE" ]; then
  echo "Usage: ./quick-add-run.sh results/2026-03-31-*.json"
  exit 1
fi

# 1. Copy to dashboard data
cp "$RUN_FILE" dashboard/published/data/

# 2. Regenerate aggregated data
./regenerate-dashboard-data.sh

# 3. Rebuild all pages
cd dashboard/build
./rebuild-all.sh

# 4. QA check
cd ../..
./skills/qa-verdict-dashboard/full-qa.sh

# 5. Deploy
if [ $? -eq 0 ]; then
  git add dashboard-data.json dashboard/
  git commit -m "feat: Add evaluation run $(basename $RUN_FILE .json)"
  git push origin main
  echo "✅ Deployed to https://hnshah.github.io/verdict/"
else
  echo "❌ QA failed, not deploying"
  exit 1
fi
```

### Create Rebuild Script

```bash
#!/bin/bash
# dashboard/build/rebuild-all.sh - Rebuild all dashboard pages

set -e

echo "Rebuilding all dashboard pages..."

# Generate main dashboard
node extractors/dashboard-from-data.js ../../dashboard-data.json > data/dashboard.json
node build.js data/dashboard.json --template templates/dashboard.html
cp output/dashboard/index.html ../published/index.html
echo "✅ Main dashboard"

# Rebuild model pages
count=0
jq -r '.models | keys[]' ../../dashboard-data.json | while read model; do
  safe_name=$(echo "$model" | sed 's/[:]/-/g; s/[.]/-/g')
  node extractors/model-from-data.js "$model" ../../dashboard-data.json > "data/model-temp.json" 2>/dev/null
  node build.js "data/model-temp.json" --template templates/model.html
  mkdir -p "../published/models/$safe_name"
  cp "output/model-temp/index.html" "../published/models/$safe_name/"
  ((count++))
done
echo "✅ $count model pages"

# Rebuild run pages
run_count=0
for f in ../../dashboard/published/data/2026-*.json; do
  run_id=$(basename "$f" .json | sed 's/2026-03-31-//')
  node extractors/run.js "$f" > "data/run-temp.json" 2>/dev/null
  node build.js "data/run-temp.json" --template templates/run.html
  mkdir -p "../published/runs/$run_id"
  cp "output/run-temp/index.html" "../published/runs/$run_id/"
  ((run_count++))
done
echo "✅ $run_count run pages"

echo ""
echo "All pages rebuilt successfully!"
```

---

## Automation

### Automatic Run → Dashboard Pipeline

**Option 1: GitHub Actions (Recommended)**

```yaml
# .github/workflows/update-dashboard.yml
name: Update Dashboard

on:
  push:
    paths:
      - 'results/*.json'
      - 'dashboard/published/data/*.json'

jobs:
  update-dashboard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Regenerate dashboard
        run: |
          ./regenerate-dashboard-data.sh
          cd dashboard/build
          ./rebuild-all.sh
      
      - name: QA Check
        run: ./skills/qa-verdict-dashboard/full-qa.sh
      
      - name: Commit and push
        run: |
          git config user.name "Verdict Bot"
          git config user.email "bot@verdict.dev"
          git add dashboard/
          git commit -m "chore: Auto-update dashboard" || exit 0
          git push
```

**Option 2: Post-Run Hook**

Add to `verdict.yaml`:

```yaml
hooks:
  post_run: "./update-dashboard.sh"
```

```bash
#!/bin/bash
# update-dashboard.sh

LATEST_RUN=$(ls -t results/*.json | head -1)

if [ -n "$LATEST_RUN" ]; then
  echo "Adding $LATEST_RUN to dashboard..."
  ./quick-add-run.sh "$LATEST_RUN"
fi
```

---

## Troubleshooting

### Issue: Run not showing in dashboard

**Check:**
1. Is run file in `dashboard/published/data/`?
   ```bash
   ls dashboard/published/data/2026-*.json
   ```

2. Is it in `dashboard-data.json`?
   ```bash
   jq '[.cases[].runs[].run_id] | unique' dashboard-data.json
   ```

3. Regenerate if missing:
   ```bash
   ./regenerate-dashboard-data.sh
   ```

### Issue: Model names inconsistent

**Fix:** Run cleanup
```bash
node clean-data.cjs
```

This normalizes:
- `llama3.2-3b` → `llama3.2:3b`
- `qwen2.5-7b` → `qwen2.5:7b`
- Removes test models

### Issue: Duplicate runs

**Audit:**
```bash
./audit-data.sh
```

**Remove:**
```bash
./remove-duplicates.sh
```

### Issue: Dashboard pages blank

**Rebuild extractors:**
```bash
cd dashboard/build
./rebuild-all.sh
```

### Issue: QA failing

**Run audit:**
```bash
./audit-data.sh
./skills/qa-verdict-dashboard/full-qa.sh
```

Fix issues, then rebuild.

---

## Quick Reference

### Run Eval
```bash
npx verdict run --eval-pack eval-packs/my-test.yaml
```

### Add to Dashboard
```bash
cp results/LATEST.json dashboard/published/data/
./regenerate-dashboard-data.sh
cd dashboard/build && ./rebuild-all.sh
```

### QA & Deploy
```bash
./skills/qa-verdict-dashboard/full-qa.sh
git add . && git commit -m "feat: Add run" && git push
```

### Check Status
```bash
./audit-data.sh                                # Data quality
./skills/qa-verdict-dashboard/full-qa.sh      # Pre-deploy QA
jq '.meta' dashboard-data.json                 # Stats
```

---

## Next Steps

1. **Create automation scripts** (quick-add-run.sh, rebuild-all.sh)
2. **Set up GitHub Actions** for auto-deployment
3. **Document model providers** (how to add Ollama, MLX, etc.)
4. **Create eval pack templates** (common test patterns)
5. **Monitor dashboard** (set up alerts for failures)

---

**Last Updated:** 2026-03-31  
**Dashboard:** https://hnshah.github.io/verdict/  
**Repo:** https://github.com/hnshah/verdict
