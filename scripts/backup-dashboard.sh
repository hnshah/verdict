#!/bin/bash
# Backup dashboard before regeneration

set -e

TIMESTAMP=$(date -u +%Y-%m-%d-%H-%M-%S)
BACKUP_DIR="dashboard/backups"

mkdir -p "$BACKUP_DIR"

echo "📦 Creating backup: $TIMESTAMP"

# Backup dashboard-data.json
if [ -f dashboard/published/dashboard-data.json ]; then
  cp dashboard/published/dashboard-data.json \
     "$BACKUP_DIR/${TIMESTAMP}-dashboard-data.json"
  echo "  ✓ dashboard-data.json"
  
  # Create metadata
  CASES=$(jq -r '.meta.total_cases' dashboard/published/dashboard-data.json 2>/dev/null || echo "unknown")
  MODELS=$(jq -r '.meta.total_models' dashboard/published/dashboard-data.json 2>/dev/null || echo "unknown")
  RUNS=$(jq -r '.meta.total_runs' dashboard/published/dashboard-data.json 2>/dev/null || echo "unknown")
  
  cat > "$BACKUP_DIR/${TIMESTAMP}-metadata.json" << EOF
{
  "backup_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "dashboard_state": {
    "total_cases": $CASES,
    "total_models": $MODELS,
    "total_runs": $RUNS
  },
  "trigger": "${TRIGGER:-manual}",
  "commit_sha": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
}
EOF
  echo "  ✓ metadata.json"
else
  echo "  ⚠ dashboard-data.json not found, skipping"
fi

# Backup all published files
if ls dashboard/published/*.json 1> /dev/null 2>&1; then
  tar -czf "$BACKUP_DIR/${TIMESTAMP}-published.tar.gz" \
    dashboard/published/*.json 2>/dev/null || true
  echo "  ✓ published files (tarball)"
fi

echo "✅ Backup complete: $BACKUP_DIR/$TIMESTAMP"
