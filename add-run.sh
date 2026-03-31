#!/bin/bash
# add-run.sh - Add a new evaluation run to the dashboard
# Usage: ./add-run.sh <path-to-run-json>

set -e

if [ -z "$1" ]; then
  echo "Usage: ./add-run.sh <path-to-run-json>"
  echo ""
  echo "Example:"
  echo "  ./add-run.sh results/2026-03-31-2026-03-31T20-15-30.json"
  exit 1
fi

RUN_FILE="$1"

if [ ! -f "$RUN_FILE" ]; then
  echo "❌ Error: File not found: $RUN_FILE"
  exit 1
fi

RUN_NAME=$(jq -r '.name // "Unnamed Run"' "$RUN_FILE")
RUN_ID=$(basename "$RUN_FILE" .json)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Adding run: $RUN_NAME"
echo "File: $RUN_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Copy to published data
echo "[1/4] Copying run to published/data/..."
cp "$RUN_FILE" dashboard/published/data/
echo "✅ Copied"

# Step 2: Regenerate dashboard data
echo ""
echo "[2/4] Regenerating dashboard-data.json..."
mkdir -p results
rm -f results/*.json 2>/dev/null
cp dashboard/published/data/2026-03-31-*.json results/ 2>/dev/null || true

npm run dev -- dashboard generate \
  --results ./results \
  --output ./dashboard-data.json 2>&1 | grep -E "Models:|Cases:|Runs:"

# Step 3: Inject into dashboard
echo ""
echo "[3/4] Injecting data into dashboard HTML..."
python3 << 'EOF'
import json

with open('dashboard-data.json') as f:
    data = json.load(f)

with open('dashboard/templates/index.html') as f:
    template = f.read()

html = template.replace('/*__DASHBOARD_DATA__*/null', json.dumps(data))

with open('dashboard/published/index.html', 'w') as f:
    f.write(html)

print(f"✅ Dashboard updated")
print(f"   Runs: {data['meta']['total_runs']}")
print(f"   Cases: {data['meta']['total_cases']}")
print(f"   Models: {data['meta']['total_models']}")
EOF

# Step 4: Commit and push
echo ""
echo "[4/4] Deploying to GitHub..."
git add dashboard-data.json dashboard/published/
git commit -m "feat: Add evaluation run - $RUN_NAME"
git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Dashboard will be live in ~2 minutes:"
echo "  https://hnshah.github.io/verdict/"
echo ""
