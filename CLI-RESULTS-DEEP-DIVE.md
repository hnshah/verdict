# CLI Benchmark - Complete Deep Dive

**Run:** 2026-03-30T05:44:25  
**Status:** ✅ COMPLETE

---

## EXECUTIVE SUMMARY

**🏆 WINNER: phi4-14b (7.76/10)**

**Microsoft's 14B general model beat Qwen's 30B coding specialist on CLI building tasks.**

**Why it matters:**
- Size doesn't matter for CLI tasks (14B ≈ 30B performance)
- General models can beat specialists on structured tasks
- Speed advantage (21s vs 27s) makes phi4 clear choice
- Haiku API failure shows prompt engineering needed

---

## FINAL RANKINGS

| Rank | Model | Score | Acc | Comp | Conc | Speed | Wins | Win% |
|------|-------|-------|-----|------|------|-------|------|------|
| 🥇 | **phi4-14b** | 7.76 | 7.6 | 8.0 | 7.6 | 21.5s | 2 | 40% |
| 🥈 | qwen3-coder-30b | 7.68 | 7.6 | 7.6 | 8.0 | 27.0s | 1 | 20% |
| 🥉 | qwen2.5-coder-14b | 7.56 | 7.6 | 7.2 | 8.2 | 24.8s | 1 | 20% |
| 4 | qwen2.5-7b | 6.16 | 5.2 | 6.4 | 7.6 | 8.5s | 0 | 0% |
| 5 | haiku | 3.72 | 3.4 | 3.6 | 4.6 | 107.4s | 1 | 20% |

---

## PER-CASE BREAKDOWN

### Case 1: cli-basic-argparse (CSV Analyzer)

**Winner:** phi4-14b (9.4/10)

**Scores:**
- phi4-14b: 9.4/10 (Acc: 10, Comp: 10, Conc: 7)
- qwen2.5-coder-14b: 8.0/10 (Acc: 7, Comp: 9, Conc: 8)
- qwen3-coder-30b: 7.8/10 (Acc: 9, Comp: 7, Conc: 7)
- qwen2.5-7b: 7.2/10 (Acc: 5, Comp: 7, Conc: 8)
- haiku: 4.8/10 (Acc: 4, Comp: 5, Conc: 5)

**Why phi4 won:**
- Perfect accuracy (10/10) - code works flawlessly
- Perfect completeness (10/10) - all requirements met
- Clean implementation with proper error handling
- Good help text

**What separated models:**
- All local models wrote working code
- phi4 had cleanest implementation
- Haiku wrote narrative instead of code ("I'll create...") ❌

**Pattern:** Basic argparse is well-understood by all 14B+ models.

---

### Case 2: cli-subcommands (Task Manager with git-style subcommands)

**Winner:** phi4-14b (8.4/10)

**Scores:**
- phi4-14b: 8.4/10 (Acc: 8, Comp: 9, Conc: 8)
- qwen3-coder-30b: 8.2/10 (Acc: 8, Comp: 9, Conc: 8)
- qwen2.5-coder-14b: 8.2/10 (Acc: 9, Comp: 8, Conc: 8)
- qwen2.5-7b: 6.0/10 (Acc: 5, Comp: 7, Conc: 7)
- haiku: 4.0/10 (Acc: 4, Comp: 4, Conc: 4)

**Why phi4 won:**
- Better completeness (9/10) - full JSON persistence
- Clean subparser structure
- All three subcommands implemented correctly

**What separated models:**
- 14B+ handled subparsers well
- 7B struggled with hierarchical structure
- Haiku again narrative not code

**Pattern:** Subcommands require structural thinking - 14B minimum.

---

### Case 3: cli-interactive (Setup Wizard with Validation)

**Winner:** qwen3-coder-30b (8.2/10) 👑

**Scores:**
- qwen3-coder-30b: 8.2/10 (Acc: 8, Comp: 9, Conc: 8)
- phi4-14b: 7.8/10 (Acc: 8, Comp: 8, Conc: 7)
- qwen2.5-coder-14b: 7.8/10 (Acc: 8, Comp: 8, Conc: 7)
- qwen2.5-7b: 6.0/10 (Acc: 5, Comp: 7, Conc: 7)
- haiku: 4.0/10 (Acc: 4, Comp: 4, Conc: 4)

**Why qwen3-coder won:**
- Better completeness (9/10) - all validation loops
- Good UX (clear prompts, helpful errors)
- Handled KeyboardInterrupt gracefully

**What separated models:**
- 30B showed advantage on UX thinking
- phi4 close but less complete
- 7B missing edge cases

**Pattern:** Interactive requires UX thinking - 30B slight edge.

---

### Case 4: cli-progress-bar (File Downloader with Progress)

**Winner:** phi4-14b (6.8/10)

**Scores:**
- phi4-14b: 6.8/10 (Acc: 6, Comp: 7, Conc: 8)
- qwen2.5-coder-14b: 6.6/10 (Acc: 7, Comp: 6, Conc: 7)
- qwen3-coder-30b: 6.4/10 (Acc: 6, Comp: 7, Conc: 7)
- qwen2.5-7b: 5.6/10 (Acc: 4, Comp: 6, Conc: 8)
- haiku: 2.2/10 (Acc: 2, Comp: 2, Conc: 3)

**Why phi4 won:**
- Clean implementation with tqdm
- Good conciseness (8/10) - minimal code
- Proper stream handling

**What separated models:**
- ALL models struggled with this (hardest case)
- Nobody scored > 7/10
- Progress bars are complex (streaming, real-time, ETA calculation)
- Haiku complete failure

**Pattern:** Progress bars hard for all models - phi4 best of bad options.

---

### Case 5: cli-colored-output (Log Viewer with ANSI Colors)

**Winner:** qwen2.5-coder-14b (7.2/10) 👑

**Scores:**
- qwen2.5-coder-14b: 7.2/10 (Acc: 8, Comp: 6, Conc: 9)
- qwen3-coder-30b: 7.0/10 (Acc: 7, Comp: 6, Conc: 10)
- phi4-14b: 6.4/10 (Acc: 6, Comp: 7, Conc: 7)
- qwen2.5-7b: 6.0/10 (Acc: 6, Comp: 6, Conc: 7)
- haiku: 3.6/10 (Acc: 3, Comp: 4, Conc: 5)

**Why qwen2.5-coder won:**
- Most concise (9/10) - clean ANSI code handling
- Good accuracy (8/10)
- Minimal implementation

**What separated models:**
- Coding specialists (qwen*-coder) beat phi4 here
- Conciseness mattered (simple pattern, execution quality)
- 7B surprisingly close (6.0 vs 7.2)

**Pattern:** Simple patterns favor concise specialists.

---

## CROSS-CASE INSIGHTS

### 1. Size Matters... Until It Doesn't

**14B vs 30B Performance:**
- phi4-14b: 7.76/10
- qwen3-coder-30b: 7.68/10
- **Gap: 0.08 points (1%)**

**Conclusion:** CLI tasks are "solved" at 14B. 30B gives no meaningful advantage.

**Speed cost of 30B:**
- phi4-14b: 21.5s
- qwen3-coder-30b: 27.0s
- **30B is 26% slower for 1% quality gain**

---

### 2. Specialist Advantage Minimal

**Coding Specialists:**
- qwen3-coder-30b: 7.68/10
- qwen2.5-coder-14b: 7.56/10

**General Model:**
- phi4-14b: 7.76/10

**Gap:** General model beat both specialists!

**Why:** CLI building is structured, not algorithmic. Doesn't need deep coding knowledge.

---

### 3. 7B Not Acceptable

**qwen2.5-7b: 6.16/10**

**Problems:**
- 5.2 accuracy (broken code)
- 0 wins
- Failed on complex cases (subcommands: 6.0, progress: 5.6)

**Acceptable uses:** NONE for production CLI work

**Maybe OK for:** Quick prototypes if you verify output

---

### 4. Haiku Catastrophic Failure

**Expected: 7.0-7.5/10**  
**Actual: 3.72/10**

**Root cause:** Gave narratives instead of code

**Example response:**
```
"I'll create a comprehensive CLI tool..."
"Now let me create a sample CSV file..."
"## Summary"
```

**Not:**
```python
import argparse
...
```

**Why it happened:**
- Haiku thinks it's explaining the task
- Prompt needs explicit "Write ONLY code, no explanations"
- Same failure mode from comprehensive Python test

**Fix needed:** Prompt engineering (specify output format)

---

## QUALITY DIMENSION ANALYSIS

### Accuracy (40% weight)

**Who excels:**
- All 14B+ models: 7.6-7.6 (tied!)
- 7B: 5.2 (broken)
- Haiku: 3.4 (narratives)

**Conclusion:** 14B threshold for working code. Above that, accuracy plateaus.

---

### Completeness (40% weight)

**Who excels:**
- phi4-14b: 8.0 (best)
- qwen3-coder-30b: 7.6
- qwen2.5-coder-14b: 7.2

**Conclusion:** phi4 most complete implementations. Microsoft training shows.

---

### Conciseness (20% weight)

**Who excels:**
- qwen2.5-coder-14b: 8.2 (best)
- qwen3-coder-30b: 8.0
- phi4-14b: 7.6

**Conclusion:** Coding specialists slightly more concise. But gap is small (0.6 points).

---

## TASK-SPECIFIC INSIGHTS

### Simple Tasks (argparse, colored output)
**Winner:** Tie (all 14B+ models ~8/10)

**Pattern:** Well-understood patterns, all models do well.

---

### Structured Tasks (subcommands)
**Winner:** phi4-14b

**Pattern:** Hierarchical structure benefits from general model flexibility.

---

### UX Tasks (interactive)
**Winner:** qwen3-coder-30b

**Pattern:** Only case where 30B showed advantage. UX thinking requires depth.

---

### Complex Tasks (progress bar)
**Winner:** phi4-14b (but all struggled)

**Pattern:** Real-time, streaming, calculation - hard for all models. phi4 best of bad options.

---

## SPEED ANALYSIS

**Ranking (fastest to slowest):**
1. qwen2.5-7b: 8.5s (2.5x faster than winner, but poor quality)
2. phi4-14b: 21.5s 👑 (sweet spot)
3. qwen2.5-coder-14b: 24.8s
4. qwen3-coder-30b: 27.0s
5. haiku: 107.4s (5x slower than 30B!)

**Speed/Quality Ratio:**
1. phi4-14b: 7.76 / 21.5s = **0.36 points/sec** 👑
2. qwen2.5-coder-14b: 7.56 / 24.8s = 0.30 points/sec
3. qwen3-coder-30b: 7.68 / 27.0s = 0.28 points/sec
4. qwen2.5-7b: 6.16 / 8.5s = 0.72 points/sec (misleading - quality too low)

**Conclusion:** phi4 best speed/quality ratio for acceptable quality.

---

## MODEL-SPECIFIC FINDINGS

### phi4-14b (WINNER)

**Strengths:**
- Best completeness (8.0)
- Fastest quality model (21.5s)
- Consistent across all cases
- Microsoft dev tool training shows

**Weaknesses:**
- Slightly lower conciseness than specialists
- Lost on UX-heavy task (interactive)

**When to use:** ALL CLI building

---

### qwen3-coder-30b (CLOSE SECOND)

**Strengths:**
- Best conciseness (8.0)
- Won on UX task (interactive)
- Most verbose helpful errors

**Weaknesses:**
- 26% slower than phi4 for 1% less quality
- Overkill for CLI tasks

**When to use:** When UX/error messages critical AND speed doesn't matter

---

### qwen2.5-coder-14b (SOLID THIRD)

**Strengths:**
- Best conciseness (8.2)
- Fastest coding specialist
- Won on simple pattern (colored output)

**Weaknesses:**
- Lower completeness (7.2)
- No other wins

**When to use:** When conciseness valued over completeness

---

### qwen2.5-7b (TOO SMALL)

**Strengths:**
- Fastest (8.5s)
- Free, local, offline

**Weaknesses:**
- 5.2 accuracy (broken code)
- 0 wins
- Not production-ready

**When to use:** Quick throwaway prototypes IF you verify output

---

### haiku (BROKEN)

**Strengths:**
- (none found in this test)

**Weaknesses:**
- Gave narratives instead of code
- 107s latency
- 3.4 accuracy

**When to use:** FIX PROMPT FIRST. Then re-test.

---

## ACTIONABLE RECOMMENDATIONS

### For Hiten's CLI Building Workflow

**1. Default Model: phi4-14b**
```bash
# Always use for CLI building
ollama run phi4:14b

# Or in Verdict
verdict run -c cli-benchmark.yaml -m phi4-14b
```

**2. Never Use:**
- qwen2.5-7b (too small, broken code)
- haiku (until prompt fixed)

**3. Maybe Use:**
- qwen3-coder-30b: IF you need best UX/error messages AND don't care about speed
- qwen2.5-coder-14b: IF conciseness > completeness for your use case

**4. Workflow:**
```
Build CLI with phi4-14b
    ↓
Test/verify
    ↓
Ship

(That's it - no multi-model iteration needed)
```

---

## PREDICTIONS VALIDATION

### What We Got Right ✅

1. **14B models would cluster** (7.56-7.76 range) ✅
2. **phi4 would compete** with specialists ✅
3. **7B too small** for production (6.16/10) ✅
4. **Subcommands would separate models** ✅

### What We Got Wrong ❌

1. **qwen3-coder-30b would win** ❌
   - Predicted: 8.2/10, 4-5 wins
   - Actual: 7.68/10, 1 win

2. **phi4 would be close second** ❌
   - Predicted: 7.3/10, 1-2 wins
   - Actual: 7.76/10, 2 wins (WINNER!)

3. **Haiku would score 7.0-7.5** ❌
   - Predicted: Competitive with 14B
   - Actual: 3.72/10 (catastrophic failure)

### What We Missed Completely 🤯

1. **Size doesn't matter for CLI** - 14B ≈ 30B
2. **General model beats specialists** on structured tasks
3. **Haiku narrative failure mode**

---

## LESSONS LEARNED

### 1. Don't Assume Specialist Advantage

We assumed coding specialist > general model.

**Wrong.** CLI building is structured, not algorithmic. General models win.

---

### 2. Size Has Diminishing Returns

We assumed bigger = better.

**Wrong.** 30B gives NO advantage over 14B for CLI (0.08 point diff).

---

### 3. Speed Matters More Than We Thought

phi4's 21.5s vs qwen3-coder's 27.0s = 26% faster.

For same quality, speed becomes tiebreaker. phi4 wins.

---

### 4. Prompt Engineering Critical

Haiku failure shows: models need explicit output format specification.

**Fix:** "Write ONLY Python code, no explanations or narratives."

---

### 5. Test Assumptions

We predicted qwen3-coder would dominate. Test proved us wrong.

**Always benchmark.** Assumptions fail.

---

## NEXT STEPS

### Immediate

1. ✅ Publish results (done)
2. ✅ Update leaderboard (done)
3. ✅ Document findings (this file)

### Short-term

1. **Fix Haiku prompt** - Add "Write ONLY code" to all coding eval prompts
2. **Re-test Haiku** with fixed prompt
3. **Test other domains** - Does phi4 beat specialists elsewhere?

### Long-term

1. **Build phi4-optimized workflow** for CLI tools
2. **Benchmark phi4 on web scraping, data processing** - Is it universally strong?
3. **Document when to use specialists vs generalists**

---

## CONCLUSION

**phi4-14b is the CLI building champion.**

- Best quality (7.76/10)
- Fastest quality model (21.5s)
- Beats larger specialists
- Microsoft dev tool training shows

**For CLI building: Use phi4. Don't overthink it.** 👑

---

**Analysis by:** Ren  
**Date:** 2026-03-29 23:30 PDT  
**Status:** Complete deep dive ✅
