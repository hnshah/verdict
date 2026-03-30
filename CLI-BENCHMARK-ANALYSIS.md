# CLI Building Benchmark - Analysis Framework

**Run Started:** 2026-03-29 22:44 PDT  
**Models:** 5 (qwen3-coder-30b, phi4-14b, qwen2.5-coder-14b, qwen2.5-7b, haiku)  
**Cases:** 5 CLI building challenges  
**Total Evaluations:** 25

---

## Research Questions

### 1. Which models excel at CLI tools specifically?

**Hypothesis:** Coding specialists (qwen*-coder) will dominate due to:
- Strong Python knowledge
- Understanding of argparse patterns
- Error handling expertise

**Counter-hypothesis:** Phi4 might compete due to Microsoft's focus on practical dev tools.

**Data needed:**
- Overall scores by model
- Per-case breakdown
- Win rates on CLI-specific patterns

---

### 2. Is there a CLI complexity curve?

**Cases ranked by complexity:**
1. **Basic argparse** (simplest) - CSV analyzer, single operation
2. **Colored output** (medium) - Parsing + ANSI codes
3. **Interactive** (medium) - Validation loops, user feedback
4. **Subcommands** (complex) - Multiple parsers, JSON persistence
5. **Progress bar** (complex) - Streaming, real-time updates

**Hypothesis:** Gap between models widens on complex cases.

**Look for:**
- Do all models score similar on basic argparse?
- Does phi4-14b fall behind on progress bar/subcommands?
- Does size matter more on complex tasks?

---

### 3. Local vs API for CLI tasks?

**Haiku baseline:** Known strong performer (7.2/10 on general coding)

**Questions:**
- Can qwen3-coder-30b match or beat Haiku?
- Is phi4-14b close enough that speed advantage matters?
- Does 7B (qwen2.5) provide acceptable quality for fast iteration?

**Trade-offs:**
- Haiku: Fast API, proven quality, cost per call
- Local 30B: Slower, free, offline capable
- Local 14B: Speed/quality balance
- Local 7B: Fastest, good enough?

---

### 4. What patterns do models struggle with?

**CLI-specific challenges:**
- **Subparsers** (hierarchical structure)
- **Input validation loops** (while True + break)
- **ANSI color codes** (escape sequences)
- **Stream processing** (chunked downloads)
- **Error messages** (user-friendly guidance)

**Look for:**
- Do models give bare code or include help text?
- Are error messages clear or generic?
- Do they handle edge cases (empty file, missing column)?
- Imports correct? (colorama vs manual ANSI)

---

### 5. Speed vs Quality on CLI tasks?

**Speed rankings (from Army test):**
1. qwen2.5-coder-14b: 18.4s
2. phi4-14b: 19.5s
3. qwen3-coder-30b: 21.2s
4. Haiku: ~30s (API latency)
5. qwen2.5-7b: 12.0s (fastest)

**Questions:**
- Does fastest (7B) provide acceptable quality?
- Is phi4's 1s advantage over qwen3-coder worth quality difference?
- Does Haiku's API overhead justify quality?

---

## Analysis Framework

### Per-Case Analysis Template

For each case, extract:

**Winner:**
- Model + Score
- Why it won (what did it do better?)

**Common Failures:**
- What did most models miss?
- Which requirement was hardest?

**Surprises:**
- Unexpected winner
- Quality inversion (smaller beats larger)

**Pattern:**
- What does success look like on this case type?

---

### Overall Rankings Template

**Leaderboard:**
```
Rank | Model              | Score | Acc | Comp | Conc | Latency | Wins
-----|-------------------|-------|-----|------|------|---------|-----
  1  | [MODEL]           | X.X   | X.X | X.X  | X.X  | XXXXXms | X
```

**Insights:**
- Top model for CLI building: [MODEL]
- Best value (quality/speed): [MODEL]
- Acceptable minimum: [MODEL] (good enough for iteration)

---

### Case-Specific Winners

| Case              | Winner        | Score | Why                          |
|-------------------|--------------|-------|------------------------------|
| Basic argparse    | [MODEL]      | X.X   | Clean, complete, help text   |
| Subcommands       | [MODEL]      | X.X   | Correct subparsers structure |
| Interactive       | [MODEL]      | X.X   | Validation loops, UX         |
| Progress bar      | [MODEL]      | X.X   | Stream handling, tqdm        |
| Colored output    | [MODEL]      | X.X   | ANSI codes, colorama         |

**Pattern:** Does one model dominate all? Or task-specific winners?

---

### Quality Dimensions

**Accuracy (40%):**
- Does code work?
- Correct imports?
- No syntax errors?
- Logic sound?

**Completeness (40%):**
- All requirements met?
- Help text included?
- Error handling present?
- Edge cases covered?

**Conciseness (20%):**
- Clean code?
- No unnecessary complexity?
- Pythonic patterns?
- Good variable names?

**Look for:**
- Which dimension separates models?
- Do some trade conciseness for completeness?
- Are there systematic gaps (e.g., all forget help text)?

---

### Specialist vs Generalist

**Coding Specialists:**
- qwen3-coder-30b
- qwen2.5-coder-14b

**Generalists:**
- phi4-14b (general model)
- qwen2.5-7b (general model)
- haiku (general API)

**Hypothesis:** Specialists should dominate.

**Evidence needed:**
- Average specialist score vs average generalist score
- Case-by-case breakdown
- Quality dimension differences

---

### Size Scaling

**Test progression:**
- 7B → 14B → 30B
- All qwen family for apples-to-apples

**Questions:**
- Linear improvement with size?
- Diminishing returns after 14B?
- Is 30B worth 2x slower inference?

**Look for:**
- Score delta: 7B → 14B
- Score delta: 14B → 30B
- Quality/latency ratio at each tier

---

### API vs Local Decision Framework

**When to use Haiku (API):**
- [Conditions based on test results]

**When to use qwen3-coder-30b (Local 30B):**
- [Conditions]

**When to use phi4-14b (Local 14B):**
- [Conditions]

**When to use qwen2.5-7b (Local 7B):**
- [Conditions]

**Decision matrix:**
```
Priority      | Recommended Model | Why
--------------|------------------|---------------------------
Max Quality   | [MODEL]          | [Score + reasoning]
Speed         | [MODEL]          | [Latency + acceptable quality]
Offline       | [MODEL]          | Best local option
Cost          | [MODEL]          | Free local, best quality
Iteration     | [MODEL]          | Fast feedback loop
```

---

### Failure Patterns

**Things to look for in responses:**

**Red Flags:**
- Bare `except:` (should be specific exceptions)
- Missing help text
- No input validation
- Generic error messages
- Imports that don't exist
- Incomplete implementations

**Good Signs:**
- Type hints used
- Clear variable names
- Help text with examples
- Specific exception handling
- User-friendly error messages
- Edge case handling

**Document:**
- Which models show red flags consistently?
- Are there model-specific failure patterns?

---

### Recommendations Output

**For Hiten's CLI building workflow:**

**Best model for:**
- **Quick prototyping:** [MODEL] (fast, good enough)
- **Production CLI:** [MODEL] (complete, polished)
- **Learning examples:** [MODEL] (clean, educational)
- **Complex tools:** [MODEL] (handles edge cases)

**Avoid:**
- [MODEL] for [REASON]

**Workflow:**
1. Start with [FAST MODEL] for iteration
2. Refine with [QUALITY MODEL] for polish
3. OR: Just use [BALANCED MODEL] throughout

---

**Status:** Framework ready, waiting for results...

**When results arrive:**
1. Extract all scores
2. Fill in templates
3. Generate insights
4. Publish to leaderboard
5. Document learnings
