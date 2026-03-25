#!/usr/bin/env bash
# manual-compare.sh — qwen3:235b vs llama3.3:70b side-by-side
# Run on the machine where Ollama is running (macs164)
# Usage: bash manual-compare.sh
#
# Output: results/manual-compare-YYYY-MM-DD.md

set -euo pipefail

OLLAMA_HOST="${OLLAMA_HOST:-localhost:11434}"
MODELS=("qwen3:235b" "llama3.3:70b")
OUTDIR="results"
DATE=$(date +%Y-%m-%d)
OUTFILE="$OUTDIR/manual-compare-$DATE.md"
TIMEOUT=300  # 5 min per call

mkdir -p "$OUTDIR"

# ── Prompts (5 representative cases from general + reasoning packs) ──────────
declare -A PROMPTS CRITERIA
PROMPTS[gen-003]="Explain the difference between a process and a thread in one paragraph."
CRITERIA[gen-003]="Covers: separate memory space vs shared, overhead difference, use cases for each"

PROMPTS[gen-006]="Write a JavaScript function that returns the sum of all even numbers in an array."
CRITERIA[gen-006]="Working JS function, handles empty array, filters even numbers with % 2 === 0, returns sum"

PROMPTS[reason-001]="A bat and a ball cost \$1.10 total. The bat costs \$1.00 more than the ball. How much does the ball cost? Show your reasoning."
CRITERIA[reason-001]="Correct: \$0.05. Must show reasoning, explain why \$0.10 is wrong."

PROMPTS[reason-005]="You're in a room with two doors. One leads to freedom, one to a lion. Two guards know which is which. One always lies, one always tells the truth. You can ask one guard one question. What do you ask?"
CRITERIA[reason-005]="Ask either guard: 'What would the other guard say is the door to freedom?' then take the opposite."

PROMPTS[reason-007]="A snail is at the bottom of a 10-foot well. Each day it climbs 3 feet, each night it slides back 2 feet. How many days to escape?"
CRITERIA[reason-007]="8 days. Net 1ft/day but escapes during day 8 climb. Common wrong answer: 10."

CASE_IDS=("gen-003" "gen-006" "reason-001" "reason-005" "reason-007")

# ── Helper: call Ollama ───────────────────────────────────────────────────────
call_ollama() {
  local model="$1"
  local prompt="$2"
  local payload
  payload=$(jq -nc \
    --arg model "$model" \
    --arg prompt "$prompt" \
    '{model: $model, messages: [{role: "user", content: $prompt}], stream: false, temperature: 0}')

  local start elapsed response text
  start=$(date +%s%3N)
  response=$(curl -sf \
    --max-time "$TIMEOUT" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "http://$OLLAMA_HOST/v1/chat/completions" 2>&1) || {
    echo "ERROR: curl failed for $model — $response"
    return 1
  }
  elapsed=$(( $(date +%s%3N) - start ))

  text=$(echo "$response" | jq -r '.choices[0].message.content // "ERROR: empty response"')
  echo "LATENCY_MS=$elapsed"
  echo "---RESPONSE---"
  echo "$text"
}

# ── Run ───────────────────────────────────────────────────────────────────────
echo "🔬 Manual compare: ${MODELS[*]}"
echo "   Prompts: ${#CASE_IDS[@]} cases"
echo "   Output:  $OUTFILE"
echo ""

# Write header
cat > "$OUTFILE" << HEADER
# Manual Model Comparison: qwen3:235b vs llama3.3:70b
**Date:** $DATE
**Cases:** ${#CASE_IDS[@]} (gen-003, gen-006, reason-001, reason-005, reason-007)
**Method:** Direct Ollama calls, sequential, temperature=0

---

HEADER

# Track totals for summary
declare -A TOTAL_LATENCY WIN_COUNT
for m in "${MODELS[@]}"; do
  TOTAL_LATENCY[$m]=0
  WIN_COUNT[$m]=0
done

# Run each case
for cid in "${CASE_IDS[@]}"; do
  prompt="${PROMPTS[$cid]}"
  criteria="${CRITERIA[$cid]}"

  echo "▶ $cid"
  echo "  Prompt: ${prompt:0:60}..."
  echo ""
  {
    echo "## $cid"
    echo ""
    echo "**Prompt:** $prompt"
    echo ""
    echo "**Criteria:** $criteria"
    echo ""
  } >> "$OUTFILE"

  # Run each model sequentially
  declare -A RESPONSES LATENCIES
  for model in "${MODELS[@]}"; do
    echo "  [$model] calling..."
    raw=$(call_ollama "$model" "$prompt" 2>&1)
    lat=$(echo "$raw" | grep "^LATENCY_MS=" | cut -d= -f2)
    resp=$(echo "$raw" | awk '/^---RESPONSE---/{found=1; next} found{print}')

    LATENCIES[$model]="${lat:-0}"
    RESPONSES[$model]="$resp"
    TOTAL_LATENCY[$model]=$(( ${TOTAL_LATENCY[$model]} + ${lat:-0} ))

    echo "  [$model] done — ${lat}ms"
  done

  # Write side-by-side
  for model in "${MODELS[@]}"; do
    {
      echo "### $model (${LATENCIES[$model]}ms)"
      echo ""
      echo "${RESPONSES[$model]}"
      echo ""
      echo "---"
      echo ""
    } >> "$OUTFILE"
  done

  # Prompt for winner (interactive)
  echo ""
  echo "  ┌─ Judge this case ─────────────────────────────────────────"
  echo "  │ Criteria: $criteria"
  echo "  │"
  for model in "${MODELS[@]}"; do
    echo "  │ [$model] (${LATENCIES[$model]}ms):"
    echo "${RESPONSES[$model]}" | fold -s -w 70 | head -5 | sed 's/^/  │   /'
    echo "  │"
  done
  echo "  │ Winner? [1=${MODELS[0]} / 2=${MODELS[1]} / t=tie / s=skip]"
  echo -n "  └▶ "
  read -r choice

  winner="(skipped)"
  case "$choice" in
    1) winner="${MODELS[0]}"; WIN_COUNT[${MODELS[0]}]=$(( ${WIN_COUNT[${MODELS[0]}]} + 1 )) ;;
    2) winner="${MODELS[1]}"; WIN_COUNT[${MODELS[1]}]=$(( ${WIN_COUNT[${MODELS[1]}]} + 1 )) ;;
    t|T) winner="TIE" ;;
  esac

  echo "" >> "$OUTFILE"
  echo "**Winner:** $winner" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
  echo "---" >> "$OUTFILE"
  echo "" >> "$OUTFILE"

  echo "  Winner: $winner"
  echo ""
done

# ── Summary ───────────────────────────────────────────────────────────────────
{
  echo "## Summary"
  echo ""
  echo "| Model | Wins | Win Rate | Avg Latency |"
  echo "|-------|------|----------|-------------|"
  for model in "${MODELS[@]}"; do
    wins=${WIN_COUNT[$model]}
    total=${#CASE_IDS[@]}
    rate=$(echo "scale=0; $wins * 100 / $total" | bc)
    avg_lat=$(echo "scale=0; ${TOTAL_LATENCY[$model]} / $total" | bc)
    echo "| $model | $wins | ${rate}% | ${avg_lat}ms |"
  done
  echo ""
  echo "**Verdict:** $(
    w0=${WIN_COUNT[${MODELS[0]}]}
    w1=${WIN_COUNT[${MODELS[1]}]}
    if [ "$w0" -gt "$w1" ]; then echo "${MODELS[0]} wins"
    elif [ "$w1" -gt "$w0" ]; then echo "${MODELS[1]} wins"
    else echo "Tie"
    fi
  )"
} >> "$OUTFILE"

echo "✅ Results saved → $OUTFILE"
echo ""
cat "$OUTFILE"
