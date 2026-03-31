#!/bin/bash
set -e

echo "Rebuilding all dashboard pages..."

# Main dashboard
node extractors/dashboard-from-data.js ../../dashboard-data.json > data/dashboard.json
node build.js data/dashboard.json --template templates/dashboard.html > /dev/null
cp output/dashboard/index.html ../published/index.html
echo "✅ Main dashboard"

# Model pages
model_count=0
while IFS= read -r model; do
  safe_name=$(echo "$model" | sed 's/[:]/-/g; s/[.]/-/g')
  if node extractors/model-from-data.js "$model" ../../dashboard-data.json > "data/model-temp.json" 2>/dev/null; then
    node build.js "data/model-temp.json" --template templates/model.html > /dev/null 2>&1
    mkdir -p "../published/models/$safe_name"
    cp "output/model-temp/index.html" "../published/models/$safe_name/"
    ((model_count++))
  fi
done < <(jq -r '.models | keys[]' ../../dashboard-data.json | sort)
echo "✅ Rebuilt $model_count model pages"

# Run pages
run_count=0
for f in ../../dashboard/published/data/2026-*.json; do
  run_id=$(basename "$f" .json | sed 's/2026-03-[0-9]*-//')
  if node extractors/run.js "$f" > "data/run-temp.json" 2>/dev/null; then
    node build.js "data/run-temp.json" --template templates/run.html > /dev/null 2>&1
    mkdir -p "../published/runs/$run_id"
    cp "output/run-temp/index.html" "../published/runs/$run_id/"
    ((run_count++))
  fi
done
echo "✅ Rebuilt $run_count run pages"

echo ""
echo "All pages rebuilt successfully!"
