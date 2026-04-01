# Vision Runs Summary

**Total Vision Runs:** 3  
**Date:** 2026-04-01

---

## Run 1: Vision Model Benchmark (First Multimodal!) ✅ GOOD
**URL:** https://hnshah.github.io/verdict/runs/2026-04-01-2026-04-01T03-18-00/  
**Time:** 03:18 UTC  
**Cases:** 3 vision questions  
**Models:** llava-13b, llama-vision-11b, phi4

**Results:**
- **llava-13b: 9.1/10** (100% win rate) ✅
- phi4: 8.0/10 (0% win)
- llama-vision-11b: 4.8/10 (0% win)

**Status:** ✅ **GOOD** - LLaVA won, phi4 lower
**Evidence:** LLaVA described images accurately

---

## Run 2: Vision Comprehensive Benchmark ❌ BROKEN
**URL:** https://hnshah.github.io/verdict/runs/2026-04-01-2026-04-01T03-19-27/  
**Time:** 03:19 UTC  
**Cases:** 10 vision questions  
**Models:** llava-13b, phi4

**Results:**
- **phi4: 8.5/10** (70% win rate) ❌ **WRONG!**
- llava-13b: 8.0/10 (30% win)

**Status:** ❌ **BROKEN** - Phi4 can't see images but scored HIGHER!

**Problem:**
- Included text-only model (phi4) as contestant
- Judge rewarded phi4's "helpful guidance"
- Phi4 responses: "I cannot view images, but here's how..."
- This scored HIGHER than actual vision!

**Why Broken:**
- Vague criteria: "Describes the scene accurately"
- No penalty for NOT seeing the image
- Judge scored "helpful" over "correct"

**Examples:**
- scene-beach: llava 8.9, phi4 9.7 (phi4 gave advice, not vision!)
- object-tech: llava 8.7, phi4 9.3 (phi4 listed general tech!)

---

## Run 3: Vision Models Only Benchmark ✅ FIXED
**URL:** https://hnshah.github.io/verdict/runs/2026-04-01-2026-04-01T03-35-29/  
**Time:** 03:35 UTC  
**Cases:** 10 vision questions  
**Models:** llava-13b, llama-vision-11b, phi4-judge

**Results:**
- **llava-13b: 7.0/10** (80% win rate) ✅ Winner!
- phi4-judge: 4.9/10 (20% win) ✅ Correctly penalized!
- llama-vision-11b: 2.0/10 (0% win)

**Status:** ✅ **FIXED** - Scores reflect actual vision capability!

**What Changed:**
- Strict criteria: "Must describe SPECIFIC visual elements"
- Explicit penalty: "Generic responses score 0"
- Phi4 as judge ONLY (not contestant)

**Results Make Sense:**
- LLaVA scores highest (can see images well)
- Phi4 scores LOW (can't see, gives advice instead)
- Llama-vision scores low (struggles with vision)

---

## Recommendations

### ✅ Keep (Good Runs):
1. Run 1: Vision Model Benchmark (First Multimodal!) - 03:18
2. Run 3: Vision Models Only Benchmark - 03:35

### ⚠️ Flag (Broken Run):
3. Run 2: Vision Comprehensive Benchmark - 03:19
   - Should be marked as "INVALID - scoring error"
   - OR removed from dashboard
   - Keep as historical lesson of what NOT to do

---

## Summary

**Working Runs:** 2/3 (67%)  
**Broken Runs:** 1/3 (33%)

**Key Lesson:**  
Vision benchmarks MUST:
- Only include vision-capable models as contestants
- Use strict criteria requiring image-specific responses
- Penalize "I cannot see images" responses
- Score "correct" over "helpful"

**Best Run:** Vision Models Only Benchmark (03:35)  
- Proper evaluation  
- Correct ranking  
- Valid results

---

**Dashboard Status:** All 3 runs visible  
**Action Needed:** Consider flagging/removing Run 2 (broken)
