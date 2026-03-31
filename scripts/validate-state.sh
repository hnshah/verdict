#!/bin/bash
# State File Validation & Auto-Healing
# Detects drift between state files and actual GitHub state

set -euo pipefail

STATE_DIR="$HOME/.openclaw/ren-workspace/verdict/automation-state"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "🔍 State Validation - $(date '+%H:%M PT')"
echo ""

DRIFT_DETECTED=false

# ============================================================================
# Validate isort #1518 State
# ============================================================================

if [ -f "$STATE_DIR/isort-1518.json" ]; then
  echo "Checking isort #1518 state..."
  
  STATE_COMMENT_ID=$(jq -r '.lastCommentId' "$STATE_DIR/isort-1518.json")
  
  # Get actual latest comment
  ACTUAL_COMMENT=$(gh api /repos/PyCQA/isort/issues/1518/comments --jq '.[-1]' 2>/dev/null || echo '{}')
  ACTUAL_COMMENT_ID=$(echo "$ACTUAL_COMMENT" | jq -r '.id // 0')
  
  if [ "$STATE_COMMENT_ID" != "$ACTUAL_COMMENT_ID" ]; then
    echo "  ⚠️ DRIFT DETECTED!"
    echo "  State: $STATE_COMMENT_ID"
    echo "  Actual: $ACTUAL_COMMENT_ID"
    
    # Auto-heal
    ACTUAL_AUTHOR=$(echo "$ACTUAL_COMMENT" | jq -r '.user.login')
    ACTUAL_CREATED=$(echo "$ACTUAL_COMMENT" | jq -r '.created_at')
    
    echo "  🔧 Auto-healing state file..."
    jq --arg id "$ACTUAL_COMMENT_ID" \
       --arg author "$ACTUAL_AUTHOR" \
       --arg created "$ACTUAL_CREATED" \
       --arg checked "$NOW" \
       '.lastCommentId = $id | .lastCommentAuthor = $author | .lastCommentCreated = $created | .lastChecked = $checked' \
       "$STATE_DIR/isort-1518.json" > "$STATE_DIR/isort-1518.json.tmp"
    
    mv "$STATE_DIR/isort-1518.json.tmp" "$STATE_DIR/isort-1518.json"
    
    echo "  ✅ State healed!"
    DRIFT_DETECTED=true
  else
    echo "  ✅ State accurate (comment #$STATE_COMMENT_ID)"
  fi
else
  echo "  ⚠️ State file missing - creating..."
  
  ACTUAL_COMMENT=$(gh api /repos/PyCQA/isort/issues/1518/comments --jq '.[-1]' 2>/dev/null || echo '{}')
  ACTUAL_COMMENT_ID=$(echo "$ACTUAL_COMMENT" | jq -r '.id // 0')
  ACTUAL_AUTHOR=$(echo "$ACTUAL_COMMENT" | jq -r '.user.login')
  ACTUAL_CREATED=$(echo "$ACTUAL_COMMENT" | jq -r '.created_at')
  
  cat > "$STATE_DIR/isort-1518.json" <<EOF
{
  "repo": "PyCQA/isort",
  "issue": 1518,
  "lastCommentId": "$ACTUAL_COMMENT_ID",
  "lastCommentAuthor": "$ACTUAL_AUTHOR",
  "lastCommentCreated": "$ACTUAL_CREATED",
  "lastChecked": "$NOW"
}
EOF
  
  echo "  ✅ State file created!"
  DRIFT_DETECTED=true
fi

# ============================================================================
# Validate our-prs State
# ============================================================================

echo ""
echo "Checking our-prs state..."

if [ -f "$STATE_DIR/our-prs.json" ]; then
  # Just verify file is valid JSON
  if jq empty "$STATE_DIR/our-prs.json" 2>/dev/null; then
    PR_COUNT=$(jq 'length' "$STATE_DIR/our-prs.json")
    echo "  ✅ State valid ($PR_COUNT PRs tracked)"
  else
    echo "  ⚠️ Invalid JSON - recreating..."
    echo "[]" > "$STATE_DIR/our-prs.json"
    DRIFT_DETECTED=true
  fi
else
  echo "  ⚠️ State file missing - creating..."
  echo "[]" > "$STATE_DIR/our-prs.json"
  DRIFT_DETECTED=true
fi

# ============================================================================
# Validate exo-repo State
# ============================================================================

echo ""
echo "Checking exo-repo state..."

if [ -f "$STATE_DIR/exo-repo.json" ]; then
  if jq empty "$STATE_DIR/exo-repo.json" 2>/dev/null; then
    LAST_ISSUE=$(jq -r '.lastIssueNumber // "none"' "$STATE_DIR/exo-repo.json")
    echo "  ✅ State valid (last issue: #$LAST_ISSUE)"
  else
    echo "  ⚠️ Invalid JSON - recreating..."
    echo '{"repo":"ankitvgupta/mail-app","lastIssueNumber":0}' > "$STATE_DIR/exo-repo.json"
    DRIFT_DETECTED=true
  fi
else
  echo "  ⚠️ State file missing - creating..."
  echo '{"repo":"ankitvgupta/mail-app","lastIssueNumber":0}' > "$STATE_DIR/exo-repo.json"
  DRIFT_DETECTED=true
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
if [ "$DRIFT_DETECTED" = true ]; then
  echo "🔧 DRIFT DETECTED & HEALED"
  echo "All state files now accurate!"
else
  echo "✅ ALL STATE FILES ACCURATE"
  echo "No drift detected."
fi

echo ""
echo "Last validation: $NOW"
