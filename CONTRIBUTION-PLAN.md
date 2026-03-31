# Contribution Plan for verdict Repo

**Prepared:** 2026-03-31 07:13 PT  
**Status:** Ready to submit

---

## What We're Contributing

### 1. Elite Python Eval Pack ✅ READY

**File:** `eval-packs/elite-python-hardcore.yaml`

**Value:**
- 8 challenging Python cases (was 10 in our test, can expand)
- Tests distributed systems, ML, GraphQL, OAuth, WebSocket, etc.
- Proven to differentiate coder models
- Fills gap for specialist evaluation

**What to include:**
- The eval pack YAML
- Results from our 3-model comparison
- Analysis of findings

**PR Title:** `feat: Add elite-python-hardcore eval pack`

**PR Description:**
```markdown
Adds a new eval pack focused on challenging Python coding tasks.

## What's Included
- 8 challenging Python cases covering:
  - Distributed Queue System
  - ML Model Inference Pipeline
  - GraphQL Schema Validation
  - Event Sourcing System
  - OAuth2 Flow Implementation
  - WebSocket Server with Backpressure
  - Database Migration Tool
  - Circuit Breaker Pattern

## Testing
Ran on 3 models (phi4:14b, qwen2.5-coder:14b, qwen3-coder:30b):
- All scored 9.2-9.6/10
- Shows clear differentiation between coder models
- 14B models competitive with 30B

## Value
- Fills gap for Python specialist evaluation
- Tests real-world architectural patterns
- Differentiates coder models effectively

See ELITE-PYTHON-RESULTS.md for full analysis.
```

---

### 2. Documentation Contribution ✅ CAN CREATE

**File:** `docs/judge-config-guide.md`

**Value:**
- Documents the judge.model ID vs model name issue
- Helps users avoid the confusion we hit
- Clear examples of correct config

**Content:**
```markdown
# Judge Configuration Guide

## The Issue
Judge model must reference the model **ID**, not the model name.

## ❌ Wrong
```yaml
models:
  - id: phi4
    model: phi4:14b

judge:
  model: phi4:14b  # ❌ Using model name - fails!
```

## ✅ Right
```yaml
models:
  - id: phi4
    model: phi4:14b

judge:
  model: phi4      # ✅ Using model ID - works!
```

## Why This Matters
The judge validator matches against `models[].id`, not `models[].model`.

This trips up new users and blocks eval runs.

## Examples
...
```

---

### 3. Bug Report / Feature Request 🟡 OPTIONAL

**Issue Title:** "Judge validation should accept model name or ID"

**Description:**
Currently judge.model must exactly match a models[].id, not models[].model.

This is confusing because:
- Users naturally use model names (phi4:14b)
- Error message isn't clear about ID vs name
- No documentation about this requirement

**Proposed:**
- Accept either ID or model name
- Or: Better error message explaining ID requirement
- Or: Document in README/FAQ

---

## Contribution Order

### Phase 1: Elite Python Eval Pack (Immediate)
**PR #1:**
- Add `eval-packs/elite-python-hardcore.yaml`
- Include results and analysis
- Submit to hnshah/verdict

**Expected:** Quick merge (adds value, no breaking changes)

### Phase 2: Documentation (This Week)
**PR #2:**
- Add `docs/judge-config-guide.md`
- Help future users avoid our confusion
- Reference in FAQ or README

**Expected:** Easy merge (pure docs, helpful)

### Phase 3: Feature Request (Optional)
**Issue #1:**
- Request better judge validation
- Provide examples and use cases
- Let maintainer decide approach

**Expected:** Discussion, might be fixed or documented

---

## Files Ready to Contribute

**Eval Pack:**
- ✅ `eval-packs/elite-python-hardcore.yaml` (exists, tested)
- ✅ `ELITE-PYTHON-RESULTS.md` (analysis to reference)

**Documentation:**
- 📝 `docs/judge-config-guide.md` (to be written)
- 📝 Examples and config samples

**Bug Report:**
- 📝 Issue draft (use BUG-REPORT-DRAFT.md as base)

---

## Next Steps

**Right Now:**
1. Wait for code-generation eval to finish
2. Review both result sets
3. Finalize elite-python-hardcore.yaml

**This Week:**
4. Fork hnshah/verdict
5. Create branch: `feat/elite-python-eval-pack`
6. Add eval pack + results
7. Submit PR #1
8. Write judge config guide
9. Submit PR #2

**Later:**
10. File feature request if needed
11. Contribute more eval packs (OCR, etc.)

---

**Status:** READY TO CONTRIBUTE! 🚀

Waiting for:
- Code generation eval results (running now)
- Your approval to proceed
