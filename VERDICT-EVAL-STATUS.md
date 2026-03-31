# verdict Eval Runs - Status & Issues

**Updated:** 2026-03-31 01:02 PT

---

## Current Status: ⚠️ BLOCKED

**Issue:** verdict CLI judge model matching is broken

**Error:**
```
✖ Judge model 'phi4:14b' not found in models list
```

**What We Tried:**
1. ✅ Installed verdict CLI (npm install -g, built from source)
2. ✅ Created configs with models we have
3. ❌ Judge model validation fails even when model IS in list
4. ❌ Tried multiple config formats
5. ❌ All runs fail at judge validation stage

**Configs Tested:**
- verdict-working.yaml
- verdict-minimal.yaml
- verdict-auto.yaml

**All fail with same error!**

---

## Issue Analysis

**The Problem:**
verdict is trying to match judge.model ('phi4:14b') against models[].id ('phi4')

**Expected Behavior:**
Judge should either:
- Match by model name ('phi4:14b')
- Match by ID ('phi4')
- Auto-select from available models

**Actual Behavior:**
Neither works - always fails validation

---

## Attempted Workarounds

**1. Match model name exactly:**
```yaml
models:
  - id: phi4:14b
    provider: ollama
    model: phi4:14b
judge:
  provider: ollama
  model: phi4:14b
```
Result: ❌ Same error

**2. Use ID in judge:**
```yaml
models:
  - id: phi4
    provider: ollama
    model: phi4:14b
judge:
  id: phi4
```
Result: ❌ "judge.model: Required"

**3. No judge (auto-select):**
```yaml
models:
  - id: phi4
    provider: ollama
    model: phi4:14b
# No judge section
```
Result: ❌ "judge: Required"

---

## Next Steps

**Option 1: File Issue on verdict Repo**
- Document bug
- Provide repro steps
- Ask for config help

**Option 2: Check Recent Changes**
- verdict is v0.2.0
- Might be fixed in newer version
- Pull latest from main

**Option 3: Use Default verdict.yaml**
- But: has models we don't have
- Would need to download ~10 models
- Takes hours + lots of disk space

**Option 4: Skip verdict Evals for Now**
- Focus on isort/remindctl contributions
- Come back when verdict works

---

## Recommendation

**Let's file an issue on verdict repo!**

We can contribute:
1. ✅ Bug report (judge model matching broken)
2. ✅ Eval packs (elite-python, OCR)
3. ✅ Documentation (once evals work)

**This IS a contribution** - finding and reporting bugs helps the project!

---

**Status:** Documenting issue, will file bug report
