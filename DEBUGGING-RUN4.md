# Debugging Run 4 Failures

## Problem
Run 4 (164 cases × 4 models = 656 evals) hangs/fails silently after pre-loading.

## Investigation

### Discovery 1: Not Actually Hung
When run with `--debug` flag, verdict shows it IS processing cases:
- Pre-load: 12s ✅
- Case processing: Visible with debug output ✅
- Each case: ~7-8 seconds (model call + judge call)

**Verdict is working, just appears hung because no progress output.**

### Discovery 2: Performance Math
**Single model, 164 cases:**
- 164 cases × 8s/case = 1,312s = **22 minutes**

**4 models, 164 cases (concurrency=3 default):**
- Models run in parallel (3 at a time), but judging is sequential
- Estimated: 164 cases × (4 models / 3 concurrency × 8s + 4 judges × 3s)
- = 164 × (10.7s + 12s) = 164 × 23s = **3,772s = 63 minutes**

**Actual Run 4 behavior:**
- Ran for 7+ hours without completion
- Either: (a) truly hung, (b) extremely slow due to unknown issue, (c) hit resource limit

### Discovery 3: What Works
**Successful runs:**
- integration-test (4 cases, 1 model): 30s
- coding.yaml (10 cases, 1 model): 2 min  
- Run 13 (10 cases, 4 models): 13 min

**Pattern:** Small eval packs (<= 10 cases) complete reliably.

## Root Cause Hypotheses

### H1: Ollama Connection Pooling Issue
Large number of sequential requests (656 evals) might exhaust connection pool or hit rate limits.

### H2: Memory Leak
164 cases × 4 models building up in memory without cleanup.

### H3: Verdict Timeout/Deadlock
Some internal timeout or deadlock after X requests.

### H4: System Resource Exhaustion
64GB RAM filled up, process killed by OS.

## Solutions

### Solution 1: Split into Batches ✅ RECOMMENDED
Split HumanEval into 8 × 20-case chunks:
- humaneval-00-19.yaml (20 cases)
- humaneval-20-39.yaml (20 cases)
- ...
- humaneval-140-163.yaml (24 cases)

**Benefits:**
- Proven to work (10-case runs succeed)
- Each run: ~20 cases × 4 models × 23s = 30 min
- 8 runs × 30 min = 4 hours total (can parallelize)
- Can contribute results incrementally

### Solution 2: Increase Concurrency
Set `run.concurrency: 4` to process all 4 models truly in parallel.

**Benefits:**
- Faster completion
- Better CPU utilization

**Risks:**
- Higher memory usage
- Potential Ollama overwhelm

### Solution 3: Add Progress Output
Modify verdict to output progress every N cases.

**Benefits:**
- Visibility into long runs
- Know it's working vs hung

**Status:**
- Would require code changes to src/cli/commands/run.ts

### Solution 4: Debug Actual Hang
Let full run complete (or monitor for 2+ hours) to see if it finishes or truly hangs.

**Status:**
- Running test-humaneval-quick.yaml now (20 cases × 4 models)
- ETA: 20 × 23s = 7.7 minutes

## Recommendation

**Immediate:** 
1. Verify test-humaneval-quick.yaml completes successfully
2. If yes → split HumanEval into 8 batches, run sequentially
3. Contribute results as they complete

**Medium-term:**
1. Add progress output to verdict
2. Investigate why 164-case run took 7+ hours (vs expected 63 min)
3. Consider contributing upstream fix to verdict

## Test in Progress

**File:** test-humaneval-quick.yaml  
**Cases:** 20  
**Models:** 4  
**Concurrency:** 4  
**Expected time:** ~8 minutes  
**Started:** 00:09 PDT  
**Status:** Running...
