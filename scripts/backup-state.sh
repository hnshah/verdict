#!/bin/bash
# Daily state file backup

STATE_DIR="$HOME/.openclaw/ren-workspace/verdict/automation-state"
BACKUP_DIR="$STATE_DIR/backups"
TODAY=$(date '+%Y-%m-%d')

mkdir -p "$BACKUP_DIR"

# Backup all JSON state files
for file in "$STATE_DIR"/*.json; do
  if [ -f "$file" ]; then
    filename=$(basename "$file" .json)
    cp "$file" "$BACKUP_DIR/${filename}-${TODAY}.json"
  fi
done

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.json" -mtime +7 -delete

echo "✅ State files backed up to backups/${TODAY}"
echo "$(ls -1 $BACKUP_DIR/*${TODAY}.json | wc -l) files backed up"
