#!/bin/bash
# monitor-verdict.sh - Monitor verdict eval runs with health checks
# Usage: ./monitor-verdict.sh <config-file> [poll-interval-sec]

set -euo pipefail

CONFIG_FILE="${1:?Config file required}"
POLL_INTERVAL="${2:-60}"  # Default 60s poll interval
RESULTS_DIR="$(dirname "$0")/../results"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log_info() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} ✅ $*"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} ⚠️  $*"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')]${NC} ❌ $*"
}

# Get baseline result count
BASELINE_COUNT=$(ls -1 "$RESULTS_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')

log_info "Starting verdict run: $CONFIG_FILE"
log_info "Baseline result count: $BASELINE_COUNT"
log_info "Poll interval: ${POLL_INTERVAL}s"
echo ""

# Start verdict in background
npm run dev -- run --config "$CONFIG_FILE" > /tmp/verdict-monitor-$$.log 2>&1 &
VERDICT_PID=$!

log_success "Verdict started (PID: $VERDICT_PID)"

# Track state
START_TIME=$(date +%s)
LAST_OUTPUT_TIME=$START_TIME
PRELOAD_COMPLETE=false
EVAL_STARTED=false
HUNG_THRESHOLD=300  # 5 minutes without output = hung

# Monitor loop
while kill -0 $VERDICT_PID 2>/dev/null; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    # Check for new result file
    CURRENT_COUNT=$(ls -1 "$RESULTS_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
    
    if [ "$CURRENT_COUNT" -gt "$BASELINE_COUNT" ]; then
        log_success "Result file detected!"
        NEW_RESULT=$(ls -t "$RESULTS_DIR"/*.json 2>/dev/null | head -1)
        log_info "Result: $NEW_RESULT"
        
        # Extract summary
        if command -v jq &> /dev/null; then
            MODELS=$(jq -r '.summary | keys | join(", ")' "$NEW_RESULT" 2>/dev/null || echo "unknown")
            CASES=$(jq '.cases | length' "$NEW_RESULT" 2>/dev/null || echo "unknown")
            log_info "Models: $MODELS"
            log_info "Cases: $CASES"
        fi
        
        # Wait for process to finish cleanup
        wait $VERDICT_PID
        EXIT_CODE=$?
        
        log_success "Run complete! (${ELAPSED}s elapsed, exit code: $EXIT_CODE)"
        echo ""
        log_info "Result file: $NEW_RESULT"
        exit 0
    fi
    
    # Check log for progress
    if [ -f /tmp/verdict-monitor-$$.log ]; then
        # Check for pre-loading completion
        if ! $PRELOAD_COMPLETE && grep -q "All models ready" /tmp/verdict-monitor-$$.log; then
            PRELOAD_COMPLETE=true
            log_success "Pre-loading complete"
        fi
        
        # Check for eval progress (case completions)
        CASE_COUNT=$(grep -c "Case.*complete" /tmp/verdict-monitor-$$.log 2>/dev/null | tr -d '\n' || echo "0")
        if [ "$CASE_COUNT" -gt 0 ] 2>/dev/null && ! $EVAL_STARTED; then
            EVAL_STARTED=true
            log_success "Evaluations started ($CASE_COUNT cases complete)"
        fi
    fi
    
    # Health check report (every poll)
    MIN_ELAPSED=$((ELAPSED / 60))
    SEC_ELAPSED=$((ELAPSED % 60))
    
    if $PRELOAD_COMPLETE; then
        if $EVAL_STARTED; then
            log_info "Status: Running evals (${MIN_ELAPSED}m ${SEC_ELAPSED}s elapsed)"
        else
            log_info "Status: Pre-load complete, starting evals... (${MIN_ELAPSED}m ${SEC_ELAPSED}s elapsed)"
        fi
    else
        log_info "Status: Pre-loading models... (${MIN_ELAPSED}m ${SEC_ELAPSED}s elapsed)"
    fi
    
    # Check for hung process
    SILENT_TIME=$((CURRENT_TIME - LAST_OUTPUT_TIME))
    if $PRELOAD_COMPLETE && [ $SILENT_TIME -gt $HUNG_THRESHOLD ]; then
        log_error "Process appears hung (${SILENT_TIME}s without progress)"
        log_warn "Last 10 log lines:"
        tail -10 /tmp/verdict-monitor-$$.log 2>/dev/null | sed 's/^/  /'
        log_warn "Continuing to monitor (kill manually if needed: kill $VERDICT_PID)"
    fi
    
    # Update last output time if log changed
    if [ -f /tmp/verdict-monitor-$$.log ]; then
        CURRENT_LOG_SIZE=$(wc -c < /tmp/verdict-monitor-$$.log)
        LAST_LOG_SIZE=${LAST_LOG_SIZE:-0}
        if [ "$CURRENT_LOG_SIZE" -gt "$LAST_LOG_SIZE" ]; then
            LAST_OUTPUT_TIME=$CURRENT_TIME
            LAST_LOG_SIZE=$CURRENT_LOG_SIZE
        fi
    fi
    
    sleep "$POLL_INTERVAL"
done

# Process exited - check why
wait $VERDICT_PID 2>/dev/null || EXIT_CODE=$?

if [ "${EXIT_CODE:-0}" -eq 0 ]; then
    log_success "Process completed successfully"
else
    log_error "Process exited with code: ${EXIT_CODE}"
    log_warn "Last 20 log lines:"
    tail -20 /tmp/verdict-monitor-$$.log 2>/dev/null | sed 's/^/  /'
fi

# Final result check
FINAL_COUNT=$(ls -1 "$RESULTS_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$FINAL_COUNT" -gt "$BASELINE_COUNT" ]; then
    NEW_RESULT=$(ls -t "$RESULTS_DIR"/*.json 2>/dev/null | head -1)
    log_success "Result file: $NEW_RESULT"
else
    log_error "No result file created!"
fi

exit "${EXIT_CODE:-1}"
