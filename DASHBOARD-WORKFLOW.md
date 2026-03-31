# Verdict Dashboard - Complete Workflow

## Current State (2026-03-31)

✅ **8 evaluation runs**
✅ **80 test cases** across different eval packs
✅ **21 unique models** tested
✅ **Single-page dashboard** with all data embedded
✅ **Brief Design System** styling

## Architecture

### Single-Page Dashboard
The dashboard is a **single HTML file** (`dashboard/published/index.html`) with:
- All data embedded as JavaScript constant
- Dynamic rendering from `DASHBOARD_DATA`
- No separate run/model detail pages needed
- Everything accessible from one page

### Data Flow

```
Individual Run JSONs 
  ↓
verdict dashboard generate
  ↓
dashboard-data.json (aggregated)
  ↓
Inject into template
  ↓
dashboard/published/index.html (with embedded data)
  ↓
GitHub Pages deployment
```

## Complete Workflow: Adding New Runs

### Step 1: Run Evaluation

```bash
# Example: Run coding eval with 3 models
verdict run eval-packs/coding.yaml --models qwen2.5:7b,phi4:14b,llama3.2:3b

# This creates: results/2026-03-31-2026-03-31THHMMSS.json
```

### Step 2: Copy Run to published/data/

```bash
# Find latest run
latest=$(ls -t results/*.json | head -1)

# Copy to published data directory
cp "$latest" dashboard/published/data/
```

### Step 3: Regenerate dashboard-data.json

```bash
# Create temporary results/ with ALL runs
mkdir -p results
cp dashboard/published/data/2026-03-31-*.json results/

# Regenerate aggregated data
verdict dashboard generate \
  --results ./results \
  --output ./dashboard-data.json

# Shows: "Models: X, Cases: Y, Runs: Z"
```

### Step 4: Inject Data into Dashboard

```bash
# Python script to inject data
python3 << 'EOF'
import json

# Load aggregated data
with open('dashboard-data.json') as f:
    data = json.load(f)

# Load template
with open('dashboard/templates/index.html') as f:
    template = f.read()

# Inject into placeholder
html = template.replace('/*__DASHBOARD_DATA__*/null', json.dumps(data))

# Save to published
with open('dashboard/published/index.html', 'w') as f:
    f.write(html)

print(f"✅ Dashboard updated")
print(f"   Runs: {data['meta']['total_runs']}")
print(f"   Cases: {data['meta']['total_cases']}")
print(f"   Models: {data['meta']['total_models']}")
EOF
```

### Step 5: Deploy to GitHub

```bash
# Commit updated dashboard
git add dashboard-data.json dashboard/published/

git commit -m "feat: Add [run name] evaluation

- X models tested
- Y test cases
- [Brief description]"

git push origin main
```

### Step 6: Verify Deployment

Wait ~2 minutes, then check:
- https://hnshah.github.io/verdict/

## Quick Add Script

Save this as `add-run.sh`:

```bash
#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./add-run.sh <path-to-run-json>"
  exit 1
fi

RUN_FILE="$1"
RUN_NAME=$(jq -r '.name' "$RUN_FILE")

echo "Adding run: $RUN_NAME"

# 1. Copy to published data
cp "$RUN_FILE" dashboard/published/data/

# 2. Regenerate dashboard data
mkdir -p results
cp dashboard/published/data/2026-03-31-*.json results/
verdict dashboard generate --results ./results --output ./dashboard-data.json

# 3. Inject into dashboard
python3 << 'EOF'
import json
with open('dashboard-data.json') as f: data = json.load(f)
with open('dashboard/templates/index.html') as f: template = f.read()
html = template.replace('/*__DASHBOARD_DATA__*/null', json.dumps(data))
with open('dashboard/published/index.html', 'w') as f: f.write(html)
print(f"✅ {data['meta']['total_runs']} runs in dashboard")
EOF

# 4. Commit and push
git add dashboard-data.json dashboard/published/
git commit -m "feat: Add $RUN_NAME"
git push origin main

echo "✅ Deployed to https://hnshah.github.io/verdict/"
```

## Troubleshooting

### Dashboard shows old data

1. Check GitHub: `curl -s https://raw.githubusercontent.com/hnshah/verdict/main/dashboard-data.json | jq .meta`
2. Check local: `jq .meta dashboard-data.json`
3. If different: Pull latest (`git pull origin main`)
4. If same but dashboard wrong: Regenerate and redeploy

### Missing runs

```bash
# Check what's in published/data/
ls dashboard/published/data/2026-03-31-*.json

# Check what's in dashboard-data.json
jq '[.cases[].runs[].run_id] | unique' dashboard-data.json

# If mismatch: Regenerate from all files
rm -rf results
mkdir results
cp dashboard/published/data/2026-03-31-*.json results/
verdict dashboard generate --results ./results --output ./dashboard-data.json
```

### Data not embedded in HTML

```bash
# Check for placeholder in template
grep "__DASHBOARD_DATA__" dashboard/templates/index.html

# Should show: const DASHBOARD_DATA = /*__DASHBOARD_DATA__*/null;

# If missing: Get correct template
cp /tmp/verdict-check/dashboard/templates/index.html dashboard/templates/
```

## Dashboard Features

### Runs Table
- Shows all evaluation runs
- Expandable to see test cases
- Filters: hide test runs, hide single-model runs
- Columns: Name, Models, Cases, Timestamp

### Model Leaderboard
- Average scores across all runs
- Total wins
- Participation stats
- Clickable model names (internal page navigation)

### Test Case Details
- Prompt shown
- All model responses
- Judge scores with reasoning
- Per-case winner highlighted

## File Structure

```
verdict-fork/
├── dashboard-data.json           # Aggregated data (root level)
├── dashboard/
│   ├── templates/
│   │   └── index.html            # Template with /*__DASHBOARD_DATA__*/ placeholder
│   ├── published/
│   │   ├── index.html            # Generated dashboard (deployed to GitHub Pages)
│   │   └── data/
│   │       ├── dashboard-data.json        # Copy of root dashboard-data.json
│   │       └── 2026-03-31-*.json         # Individual run files (8 files)
│   └── archive/                  # Old systems (preserved for reference)
└── results/                      # Temporary (gitignored, recreated as needed)
```

## Data Format

### dashboard-data.json

```json
{
  "meta": {
    "total_runs": 8,
    "total_cases": 80,
    "total_models": 21,
    "last_updated": "2026-03-31"
  },
  "models": {
    "qwen2.5:7b": { "name": "qwen2.5:7b" }
  },
  "cases": [
    {
      "id": "gen-001",
      "name": "General Question 1",
      "suite": "general",
      "prompt": "What is the capital of France?",
      "runs": [
        {
          "run_id": "2026-03-31T07-48-00",
          "run_meta": {
            "name": "Comprehensive Benchmark",
            "run_id": "2026-03-31T07-48-00",
            "config_file": "verdict.yaml"
          },
          "responses": {
            "qwen2.5:7b": {
              "text": "The capital of France is Paris.",
              "latency_ms": 1198
            }
          },
          "scores": {
            "qwen2.5:7b": {
              "total": 10,
              "reasoning": "Perfect answer"
            }
          }
        }
      ]
    }
  ]
}
```

## CI/CD Integration

For automated dashboard updates:

```yaml
# .github/workflows/update-dashboard.yml
name: Update Dashboard

on:
  push:
    paths:
      - 'dashboard/published/data/*.json'

jobs:
  regenerate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Regenerate dashboard
        run: |
          mkdir -p results
          cp dashboard/published/data/2026-03-31-*.json results/
          npm run dev -- dashboard generate --results ./results --output ./dashboard-data.json
      
      - name: Inject into HTML
        run: python3 scripts/inject-dashboard.py
      
      - name: Commit
        run: |
          git config user.name "Dashboard Bot"
          git config user.email "bot@verdict.dev"
          git add dashboard-data.json dashboard/published/index.html
          git commit -m "chore: Auto-regenerate dashboard" || exit 0
          git push
```

## Notes

- Dashboard updates appear on GitHub Pages in ~2 minutes
- No build step required (static HTML)
- All data embedded in single file (works offline)
- Design: Brief Design System (Inter font, Tailwind CSS)
- Single-page dashboard means no broken links
