#!/bin/bash
# Verify dashboard changes are ADDITIVE (no data loss)

set -e

echo "🔍 Verifying dashboard safety..."

# Fetch latest
git fetch origin

# Count runs BEFORE (on GitHub)
BEFORE=$(git show origin/main:dashboard-data.json 2>/dev/null | jq '.meta.total_runs' 2>/dev/null || echo "0")

# Count runs AFTER (local)
AFTER=$(jq '.meta.total_runs' dashboard-data.json 2>/dev/null || echo "0")

echo ""
echo "Runs on GitHub: $BEFORE"
echo "Runs locally:   $AFTER"
echo ""

# Check for data loss
if [ "$AFTER" -lt "$BEFORE" ]; then
  echo "❌ DANGER! Run count decreased: $BEFORE → $AFTER"
  echo ""
  echo "You may have deleted data. This is NOT safe to push."
  echo ""
  echo "To fix:"
  echo "  1. git pull origin main"
  echo "  2. Re-add your data using scripts/add-run-safely.sh"
  echo ""
  exit 1
fi

# Check if unchanged
if [ "$AFTER" -eq "$BEFORE" ]; then
  echo "⚠️  WARNING: Run count unchanged ($BEFORE)"
  echo "Are you sure you added new data?"
  echo ""
  exit 0
fi

# Success
echo "✅ Safe! Added $(($AFTER - $BEFORE)) run(s)"
echo ""
echo "Ready to push!"
