#!/bin/bash
#
# verdict-runner.sh
# Phase 1 runner for Verdict 24/7 Local Eval Machine
#
# Usage:
#   ./scripts/verdict-runner.sh --local --pack code-review
#   ./scripts/verdict-runner.sh --endpoint http://localhost:11434/v1 --model llama3.1
#

set -euo pipefail

# Defaults
DEFAULT_ENDPOINT="http://localhost:11434/v1"   # Ollama default
DEFAULT_MODEL="llama3.1"
DEFAULT_PACK="comprehensive-mix"
RESULTS_DIR="results"
DASHBOARD_DIR="dashboards"

# Parse arguments
ENDPOINT="$DEFAULT_ENDPOINT"
MODEL="$DEFAULT_MODEL"
PACK="$DEFAULT_PACK"
RUN_MODE="local"

while [[ $# -gt 0 ]]; do
    case $1 in
        --local)
            ENDPOINT="$DEFAULT_ENDPOINT"
            RUN_MODE="local"
            shift
            ;;
        --endpoint)
            ENDPOINT="$2"
            shift 2
            ;;
        --model)
            MODEL="$2"
            shift 2
            ;;
        --pack)
            PACK="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "🚀 Verdict Runner"
echo "   Endpoint : $ENDPOINT"
echo "   Model    : $MODEL"
echo "   Eval Pack: $PACK"
echo "   Mode     : $RUN_MODE"
echo ""

# Ensure directories exist
mkdir -p "$RESULTS_DIR" "$DASHBOARD_DIR"

# Timestamp for this run
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
RUN_ID="run_${TIMESTAMP}"

echo "▶️  Running Verdict evaluation..."
verdict run \
    --base-url "$ENDPOINT" \
    --model "$MODEL" \
    --eval-pack "$PACK" \
    --output "$RESULTS_DIR/$RUN_ID.json" \
    --dashboard "$DASHBOARD_DIR/$RUN_ID.html" \
    || {
        echo "❌ Verdict run failed"
        exit 1
    }

echo "✅ Evaluation complete"
echo "   Results   : $RESULTS_DIR/$RUN_ID.json"
echo "   Dashboard : $DASHBOARD_DIR/$RUN_ID.html"

# Optional: regenerate main dashboard index
if command -v verdict &> /dev/null; then
    echo "📊 Regenerating dashboard index..."
    verdict dashboard --input "$RESULTS_DIR" --output "$DASHBOARD_DIR/index.html" || true
fi

echo "🎉 Run $RUN_ID finished successfully"