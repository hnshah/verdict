# CLI Benchmark - Pre-Test Predictions

**Written before results known** — Let's see if we're right!

---

## Model Predictions (Based on Army Test)

### 🥇 qwen3-coder-30b (Expected Winner)
**Army Score:** 8.07/10 (Winner, 67% win rate)

**Strengths:**
- Coding specialist (fine-tuned for code)
- 30B parameters (largest local model in test)
- Dominated Army test across all cases

**Expected Performance:**
- Should win or place top 2 on all CLI cases
- Especially strong on complex cases (subcommands, progress bar)
- Complete implementations with error handling
- Proper Python conventions

**Predicted Score:** 8.0-8.5/10
**Predicted Wins:** 4-5 out of 5 cases

**Watch for:** 
- Does it maintain dominance on CLI-specific tasks?
- Any cases where size doesn't help?

---

### 🥈 phi4-14b (Expected Strong Second)
**Army Score:** 7.2/10 (2nd place, consistent quality)

**Strengths:**
- Microsoft-trained (strong on dev tools)
- Fast (19.5s latency, nearly matches 30B)
- Balanced quality/speed

**Expected Performance:**
- Close second to qwen3-coder-30b
- Might win on basic cases (argparse, colored output)
- Clean, minimal code (high conciseness)
- Good error handling

**Predicted Score:** 7.0-7.5/10
**Predicted Wins:** 1-2 out of 5 cases

**Watch for:**
- Can it beat 30B on any cases?
- Speed advantage meaningful for iteration?

---

### 🥉 qwen2.5-coder-14b (Solid Third)
**Army Score:** 7.13/10 (3rd place)

**Strengths:**
- Coding specialist like qwen3-coder
- Fast (18.4s, fastest of specialists)
- Proven Python expertise

**Expected Performance:**
- Similar to phi4-14b (within 0.2 points)
- Might edge out phi4 on complex coding patterns
- Complete but maybe less concise

**Predicted Score:** 6.8-7.3/10
**Predicted Wins:** 0-1 out of 5 cases

**Watch for:**
- Does specialist advantage show vs phi4?
- Quality vs qwen3-coder-30b comparison (size matters?)

---

### 4️⃣ haiku (API Baseline)
**Previous Score:** 7.2/10 (on general Python coding)

**Strengths:**
- API model, proven quality
- Strong instruction following
- Good at complete implementations

**Expected Performance:**
- Should compete with 14B models
- Might beat locals on completeness
- Higher latency (API overhead)

**Predicted Score:** 7.0-7.5/10
**Predicted Wins:** 0-2 out of 5 cases

**Watch for:**
- Does API quality beat local 14B?
- Worth the latency/cost vs qwen3-coder-30b?

---

### 5️⃣ qwen2.5-7b (Fast Baseline)
**Army Score:** 5.9/10 (5th place, but fast)

**Strengths:**
- Fastest (12.0s latency)
- Free, local, offline
- Acceptable quality for iteration

**Expected Performance:**
- Clear 5th place
- But "good enough" for prototyping?
- Might surprise on basic cases

**Predicted Score:** 5.5-6.5/10
**Predicted Wins:** 0 out of 5 cases

**Watch for:**
- Is it acceptable for CLI prototyping?
- Where does quality break down?

---

## Case-Specific Predictions

### Case 1: Basic argparse (CSV analyzer)
**Predicted Winner:** phi4-14b or qwen3-coder-30b (tie likely)

**Why:** Simple pattern, all models should do well, comes down to code cleanliness.

**Expected Scores:** 7.5-9.0 range (high variance = easy case)

---

### Case 2: Subcommands (Task manager)
**Predicted Winner:** qwen3-coder-30b

**Why:** Complex hierarchical structure, 30B advantage shows here.

**Expected Scores:** 6.0-8.5 range (separates models)

---

### Case 3: Interactive (Setup wizard)
**Predicted Winner:** qwen3-coder-30b or haiku

**Why:** Requires UX thinking (prompts, validation messages). API might excel.

**Expected Scores:** 6.5-8.0 range

---

### Case 4: Progress bar (File downloader)
**Predicted Winner:** qwen3-coder-30b

**Why:** Complex (streaming, real-time updates). Size and specialization matter.

**Expected Scores:** 5.5-8.5 range (hardest case)

---

### Case 5: Colored output (Log viewer)
**Predicted Winner:** phi4-14b

**Why:** Straightforward pattern, comes down to conciseness. Microsoft model might shine.

**Expected Scores:** 7.0-8.5 range

---

## Overall Predictions

**Final Ranking:**
1. qwen3-coder-30b: 8.2/10 (4-5 wins)
2. phi4-14b: 7.3/10 (1-2 wins)
3. qwen2.5-coder-14b: 7.1/10 (0-1 wins)
4. haiku: 7.0/10 (0-1 wins)
5. qwen2.5-7b: 6.0/10 (0 wins)

**Key Insights Expected:**
- **Size matters** on complex cases (subcommands, progress)
- **Speed/quality sweet spot** is 14B (phi4 or qwen2.5-coder)
- **7B acceptable** for basic CLI prototyping, not production
- **Specialist advantage** shows clearly (qwen*-coder beats generalists)

**Surprises to Watch For:**
- Does phi4 beat qwen3-coder on any case?
- Is haiku competitive with local 14B models?
- Does 7B surprise us on basic cases?
- Are there CLI-specific patterns that change rankings?

---

**Let's see how wrong (or right) these predictions are!** 🎯

---

**Timestamp:** 2026-03-29 22:55 PDT  
**Status:** Predictions locked before results known
