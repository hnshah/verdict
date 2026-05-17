#!/bin/bash
#
# setup-cron.sh
# One-command setup for Verdict hourly evaluation cron job
#

set -e

echo "🔧 Setting up Verdict Hourly Cron Job..."

# Ensure we're in the verdict directory
if [ ! -f "scripts/verdict-runner.sh" ]; then
    echo "❌ Please run this from the root of the Verdict repository"
    exit 1
fi

# Create the cron job using Hermes
echo "📅 Creating hourly Verdict evaluation job..."
hermes cron create --file cron/verdict-hourly.yaml

echo ""
echo "✅ Verdict hourly cron job created successfully!"
echo ""
echo "You can manage it with:"
echo "  hermes cron list"
echo "  hermes cron pause verdict-hourly-eval"
echo "  hermes cron run verdict-hourly-eval"
echo ""
echo "🎉 Hourly evaluations will now run automatically"