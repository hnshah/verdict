#!/bin/bash
set -euo pipefail

# Quick test: run verdict with just gemma4:26b and gemma4:31b on one case
# to see if they return non-empty responses

cd ~/.openclaw/ren-workspace/verdict

# Create minimal test pack with ONE case
cat > test-gemma-minimal.yaml << 'EOF'
name: "Gemma Debug Test"
description: "Minimal test to check gemma4 response handling"

cases:
  - id: simple-test
    prompt: "You are a CRO expert. In 100 words, explain what a value proposition is and why it matters for conversion rates."
    criteria: "Clear definition and explanation with reasoning"
EOF

# Run verdict with just the problematic models
echo "Running verdict with gemma4:26b and gemma4:31b..." >&2

# Set a reasonable timeout (5 min = 300s)
timeout 300 verdict run \
  -c verdict.yaml \
  -p "Gemma Debug Test" \
  -m gemma4:26b,gemma4:31b \
  2>&1 | tee /tmp/verdict-debug.log || true

# Parse results from most recent run
LATEST_RESULT=$(ls -t results/*.json 2>/dev/null | head -1)

if [ -z "$LATEST_RESULT" ]; then
  echo "METRIC successful_responses=0"
  echo "METRIC avg_response_length=0"
  echo "METRIC avg_latency_ms=999999"
  exit 0
fi

# Count non-empty responses
GEMMA26B_RESPONSE=$(jq -r '.responses[0].responses."gemma4:26b".text // ""' "$LATEST_RESULT")
GEMMA31B_RESPONSE=$(jq -r '.responses[0].responses."gemma4:31b".text // ""' "$LATEST_RESULT")

SUCCESSFUL=0
TOTAL_LENGTH=0

if [ -n "$GEMMA26B_RESPONSE" ] && [ "$GEMMA26B_RESPONSE" != "null" ]; then
  SUCCESSFUL=$((SUCCESSFUL + 1))
  TOTAL_LENGTH=$((TOTAL_LENGTH + ${#GEMMA26B_RESPONSE}))
fi

if [ -n "$GEMMA31B_RESPONSE" ] && [ "$GEMMA31B_RESPONSE" != "null" ]; then
  SUCCESSFUL=$((SUCCESSFUL + 1))
  TOTAL_LENGTH=$((TOTAL_LENGTH + ${#GEMMA31B_RESPONSE}))
fi

AVG_LENGTH=$((TOTAL_LENGTH / 2))

# Get latencies
GEMMA26B_LATENCY=$(jq -r '.responses[0].responses."gemma4:26b".latency_ms // 0' "$LATEST_RESULT")
GEMMA31B_LATENCY=$(jq -r '.responses[0].responses."gemma4:31b".latency_ms // 0' "$LATEST_RESULT")
AVG_LATENCY=$(( (GEMMA26B_LATENCY + GEMMA31B_LATENCY) / 2 ))

echo "METRIC successful_responses=$SUCCESSFUL"
echo "METRIC avg_response_length=$AVG_LENGTH"
echo "METRIC avg_latency_ms=$AVG_LATENCY"
