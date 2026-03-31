#!/bin/bash
# quick-add-run.sh - Add a new evaluation run and update dashboard
# Usage: ./quick-add-run.sh results/2026-03-31-*.json

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

RUN_FILE=$1

if [ -z "$RUN_FILE" ]; then
  echo "Usage: ./quick-add-run.sh <run-file.json>"
  echo ""
  echo "Example:"
  echo "  ./quick-add-run.sh results/2026-03-31-2026-03-31T14-25-37.json"
  echo ""
  echo "Or add latest:"
  echo "  ./quick-add-run.sh \$(ls -t results/*.json | head -1)"
  exit 1
fi

if [ ! -f "$RUN_FILE" ]; then
  echo "${RED}Error: File not found: $RUN_FILE${NC}"
  exit 1
fi

echo ""
echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "${BLUE}  VERDICT: Add Run to Dashboard${NC}"
echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

RUN_NAME=$(jq -r '.name // "Unnamed Run"' "$RUN_FILE")
RUN_ID=$(basename "$RUN_FILE" | sed 's/2026-03-[0-9]*-//' | sed 's/.json//')

echo "Run: ${GREEN}$RUN_NAME${NC}"
echo "ID:  ${GREEN}$RUN_ID${NC}"
echo "File: $RUN_FILE"
echo ""

# Step 1: Copy to dashboard data
echo "${YELLOW}[1/5]${NC} Copying run to dashboard/published/data/..."
cp "$RUN_FILE" dashboard/published/data/
echo "      ✅ Copied"

# Step 2: Regenerate aggregated data
echo ""
echo "${YELLOW}[2/5]${NC} Regenerating dashboard-data.json..."
./regenerate-dashboard-data.sh > /tmp/regen.log 2>&1
if [ $? -eq 0 ]; then
  echo "      ✅ Regenerated"
else
  echo "${RED}      ❌ Failed${NC}"
  cat /tmp/regen.log
  exit 1
fi

# Step 3: Rebuild all pages
echo ""
echo "${YELLOW}[3/5]${NC} Rebuilding dashboard pages..."
cd dashboard/build
if [ ! -f "rebuild-all.sh" ]; then
  echo "${YELLOW}      Creating rebuild-all.sh...${NC}"
  cat > rebuild-all.sh << 'REBUILD_SCRIPT'
#!/bin/bash
set -e

# Main dashboard
node extractors/dashboard-from-data.js ../../dashboard-data.json > data/dashboard.json
node build.js data/dashboard.json --template templates/dashboard.html > /dev/null
cp output/dashboard/index.html ../published/index.html

# Model pages
model_count=0
jq -r '.models | keys[]' ../../dashboard-data.json | while read model; do
  safe_name=$(echo "$model" | sed 's/[:]/-/g; s/[.]/-/g')
  node extractors/model-from-data.js "$model" ../../dashboard-data.json > "data/model-temp.json" 2>/dev/null
  node build.js "data/model-temp.json" --template templates/model.html > /dev/null 2>&1
  mkdir -p "../published/models/$safe_name"
  cp "output/model-temp/index.html" "../published/models/$safe_name/"
  ((model_count++))
done

# Run pages
run_count=0
for f in ../../dashboard/published/data/2026-*.json; do
  run_id=$(basename "$f" .json | sed 's/2026-03-[0-9]*-//')
  node extractors/run.js "$f" > "data/run-temp.json" 2>/dev/null
  node build.js "data/run-temp.json" --template templates/run.html > /dev/null 2>&1
  mkdir -p "../published/runs/$run_id"
  cp "output/run-temp/index.html" "../published/runs/$run_id/"
  ((run_count++))
done

echo "✅ Rebuilt all pages"
REBUILD_SCRIPT
  chmod +x rebuild-all.sh
fi

./rebuild-all.sh > /tmp/rebuild.log 2>&1
if [ $? -eq 0 ]; then
  echo "      ✅ Pages rebuilt"
else
  echo "${RED}      ❌ Failed${NC}"
  cat /tmp/rebuild.log
  exit 1
fi

cd ../..

# Step 4: QA check
echo ""
echo "${YELLOW}[4/5]${NC} Running QA checks..."
./skills/qa-verdict-dashboard/full-qa.sh > /tmp/qa.log 2>&1
if [ $? -eq 0 ]; then
  echo "      ✅ All QA checks passed"
else
  echo "${YELLOW}      ⚠️  QA warnings (check /tmp/qa.log)${NC}"
  # Don't fail on warnings, just show them
fi

# Step 5: Deploy
echo ""
echo "${YELLOW}[5/5]${NC} Deploying to GitHub..."
git add dashboard-data.json dashboard/
git commit -m "feat: Add evaluation run '$RUN_NAME' ($RUN_ID)" > /dev/null 2>&1
git push origin main

echo ""
echo "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "${GREEN}✅ DEPLOYMENT COMPLETE${NC}"
echo "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Dashboard will be live in ~2 minutes:"
echo "${BLUE}https://hnshah.github.io/verdict/${NC}"
echo ""
