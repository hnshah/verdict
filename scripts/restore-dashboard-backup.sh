#!/bin/bash
# Restore dashboard from backup

set -e

BACKUP_DIR="dashboard/backups"

# Parse arguments
if [ "$1" = "--latest" ]; then
  # Find latest backup
  BACKUP=$(ls -t "$BACKUP_DIR"/*-dashboard-data.json 2>/dev/null | head -1)
  if [ -z "$BACKUP" ]; then
    echo "❌ No backups found"
    exit 1
  fi
  TIMESTAMP=$(basename "$BACKUP" | sed 's/-dashboard-data.json//')
elif [ -n "$1" ]; then
  TIMESTAMP="$1"
  BACKUP="$BACKUP_DIR/${TIMESTAMP}-dashboard-data.json"
  if [ ! -f "$BACKUP" ]; then
    echo "❌ Backup not found: $BACKUP"
    exit 1
  fi
else
  echo "Usage: $0 [--latest | TIMESTAMP]"
  echo ""
  echo "Available backups:"
  ls -1t "$BACKUP_DIR"/*-metadata.json 2>/dev/null | head -10 | while read f; do
    TS=$(basename "$f" | sed 's/-metadata.json//')
    echo "  $TS"
    if [ -f "$f" ]; then
      jq -r '  "    Cases: \(.dashboard_state.total_cases), Models: \(.dashboard_state.total_models), Trigger: \(.trigger)"' "$f" 2>/dev/null || true
    fi
  done
  exit 1
fi

echo "🔄 Restoring backup: $TIMESTAMP"

# Show metadata
if [ -f "$BACKUP_DIR/${TIMESTAMP}-metadata.json" ]; then
  echo ""
  echo "Backup info:"
  jq '.' "$BACKUP_DIR/${TIMESTAMP}-metadata.json"
  echo ""
fi

# Confirm
read -p "Restore this backup? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled"
  exit 0
fi

# Backup current state first
if [ -f dashboard/published/dashboard-data.json ]; then
  PRE_RESTORE=$(date -u +%Y-%m-%d-%H-%M-%S)
  cp dashboard/published/dashboard-data.json \
     "$BACKUP_DIR/${PRE_RESTORE}-pre-restore-dashboard-data.json"
  echo "✓ Current state backed up as: ${PRE_RESTORE}-pre-restore"
fi

# Restore
cp "$BACKUP" dashboard/published/dashboard-data.json
echo "✅ Restored: $TIMESTAMP"

# Show diff
echo ""
echo "Dashboard state after restore:"
jq '.meta' dashboard/published/dashboard-data.json
echo ""
echo "To deploy:"
echo "  git add dashboard/published/dashboard-data.json"
echo "  git commit -m 'chore: restore backup $TIMESTAMP'"
echo "  git push"
