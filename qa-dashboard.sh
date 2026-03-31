#!/bin/bash
# qa-dashboard.sh - Comprehensive dashboard QA
# Validates all pages, data, and links

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 VERDICT DASHBOARD QA"
echo "======================="
echo ""

ERRORS=0
WARNINGS=0

# 1. CHECK MAIN DASHBOARD
echo "1. Main Dashboard (index.html)"
echo "   - File exists: $([ -f dashboard/published/index.html ] && echo '✅' || echo '❌')"

if [ -f dashboard/published/index.html ]; then
  file_size=$(wc -c < dashboard/published/index.html)
  echo "   - File size: $file_size bytes"
  
  has_inter=$(grep -c "Inter" dashboard/published/index.html || echo 0)
  echo "   - Has Inter font: $([ $has_inter -gt 0 ] && echo '✅' || echo '❌')"
  
  has_data=$(grep -c "qwen\|phi4\|llama" dashboard/published/index.html || echo 0)
  echo "   - Has model data: $([ $has_data -gt 0 ] && echo '✅' || echo '❌')"
else
  echo "   ${RED}❌ CRITICAL: Main dashboard missing!${NC}"
  ((ERRORS++))
fi

echo ""

# 2. CHECK DASHBOARD DATA
echo "2. Dashboard Data"
if [ -f dashboard-data.json ]; then
  runs=$(jq '.meta.total_runs' dashboard-data.json)
  cases=$(jq '.meta.total_cases' dashboard-data.json)
  models=$(jq '.meta.total_models' dashboard-data.json)
  
  echo "   - Total runs: $runs"
  echo "   - Total cases: $cases"
  echo "   - Total models: $models"
  
  if [ "$models" -gt 20 ]; then
    echo "   ${YELLOW}⚠️  Warning: $models models seems high (duplicates?)${NC}"
    ((WARNINGS++))
  fi
else
  echo "   ${RED}❌ CRITICAL: dashboard-data.json missing!${NC}"
  ((ERRORS++))
fi

echo ""

# 3. CHECK MODEL PAGES
echo "3. Model Pages"
echo "   Checking all model directories..."

model_count=0
missing_pages=0
empty_pages=0

for model_dir in dashboard/published/models/*/; do
  model_name=$(basename "$model_dir")
  index_file="${model_dir}index.html"
  
  ((model_count++))
  
  if [ ! -f "$index_file" ]; then
    echo "   ${RED}❌ Missing: $model_name${NC}"
    ((missing_pages++))
    ((ERRORS++))
    continue
  fi
  
  file_size=$(wc -c < "$index_file")
  
  if [ $file_size -lt 1000 ]; then
    echo "   ${RED}❌ Empty/broken: $model_name ($file_size bytes)${NC}"
    ((empty_pages++))
    ((ERRORS++))
    continue
  fi
  
  # Check for HF link
  has_hf=$(grep -c "huggingface.co" "$index_file" || echo 0)
  
  # Check for actual data
  has_data=$(grep -c "Avg Score\|Total Wins\|Performance" "$index_file" || echo 0)
  
  if [ $has_hf -eq 0 ]; then
    echo "   ${YELLOW}⚠️  No HF link: $model_name${NC}"
    ((WARNINGS++))
  fi
  
  if [ $has_data -eq 0 ]; then
    echo "   ${RED}❌ No data: $model_name${NC}"
    ((ERRORS++))
  fi
done

echo ""
echo "   Total model pages: $model_count"
echo "   Missing pages: $missing_pages"
echo "   Empty/broken pages: $empty_pages"

echo ""

# 4. CHECK RUN PAGES
echo "4. Run Pages"
run_count=0
missing_run_pages=0

for run_dir in dashboard/published/runs/*/; do
  run_name=$(basename "$run_dir")
  index_file="${run_dir}index.html"
  
  ((run_count++))
  
  if [ ! -f "$index_file" ]; then
    echo "   ${RED}❌ Missing: $run_name${NC}"
    ((missing_run_pages++))
    ((ERRORS++))
    continue
  fi
  
  file_size=$(wc -c < "$index_file")
  
  if [ $file_size -lt 1000 ]; then
    echo "   ${RED}❌ Empty/broken: $run_name ($file_size bytes)${NC}"
    ((ERRORS++))
  fi
done

echo "   Total run pages: $run_count"
echo "   Missing run pages: $missing_run_pages"

echo ""

# 5. CHECK FOR DUPLICATES
echo "5. Duplicate Check"
echo "   Models in dashboard-data.json:"

jq -r '.models | keys[]' dashboard-data.json | sort | while read model; do
  # Check for common duplicate patterns
  if echo "$model" | grep -q "[-]3b$\|[-]7b$\|[-]14b$"; then
    colon_version=$(echo "$model" | sed 's/-\([0-9]\)/:\1/')
    if jq -e ".models[\"$colon_version\"]" dashboard-data.json > /dev/null 2>&1; then
      echo "   ${YELLOW}⚠️  Potential duplicate: $model ↔ $colon_version${NC}"
      ((WARNINGS++))
    fi
  fi
done

echo ""

# 6. SUMMARY
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "QA SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "${GREEN}✅ ALL CHECKS PASSED${NC}"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo "${YELLOW}⚠️  $WARNINGS warnings${NC}"
  exit 0
else
  echo "${RED}❌ $ERRORS errors, $WARNINGS warnings${NC}"
  echo ""
  echo "Run this script again after fixes to verify."
  exit 1
fi
