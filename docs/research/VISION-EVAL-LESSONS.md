# Vision Eval Lessons Learned

**Date:** 2026-04-01  
**Issue:** First vision eval had broken scoring  
**Status:** ✅ FIXED

---

## 🚨 Critical Issue Discovered

### **The Problem:**

**Run:** https://hnshah.github.io/verdict/runs/2026-04-01-2026-04-01T03-19-27/

**What went wrong:**
- Included phi4 (text-only model) in vision benchmark
- Phi4 CANNOT see images - responds with "I cannot view images"
- **Judge scored phi4 HIGHER than vision models!**
  - phi4: 8.5/10 (70% win rate)
  - llava-13b: 8.0/10 (30% win rate)

**Why this is broken:**
- Phi4 gave "helpful guidance" like "here's how to describe a scene"
- Judge rewarded this as "complete" and "accurate"
- **But phi4 NEVER ANSWERED the vision questions!**

### **Specific Examples:**

**scene-beach: "Describe the scene in this image"**
- llava-13b: "boat on water with..." → 8.9/10
- phi4: "I can't see it but here's how to describe scenes" → 9.7/10 ❌

**object-tech: "What devices do you see?"**
- llava-13b: "a smartphone" → 8.7/10
- phi4: "Common tech includes..." → 9.3/10 ❌

**This completely defeats the purpose of vision benchmarking!**

---

## 🔧 Root Causes

### 1. **Including text-only models in vision evals**
- phi4 has no vision capability
- Should NEVER be in a vision benchmark as a contestant
- OK as judge, NOT as eval target

### 2. **Generic judging criteria**
```yaml
rubric:
  accuracy: 0.5
  completeness: 0.3
  conciseness: 0.2
```

**Problem:** Doesn't require SEEING the image!
- "Helpful guidance" scores high on completeness
- Generic advice scores high on accuracy
- No penalty for NOT answering the actual question

### 3. **Vague eval criteria**
```yaml
criteria: "Accurately describes the scene"
```

**Problem:** Doesn't specify image-specific!
- "Here's how to describe scenes" technically "accurate"
- Judge can't tell if model saw the image
- No explicit "must describe THIS image" requirement

---

## ✅ The Fix

### 1. **Vision-only model configs**

```yaml
# verdict-vision-only.yaml
models:
  - id: llava-13b          # ✅ Vision model
  - id: llama-vision-11b   # ✅ Vision model
  # NO phi4 as contestant!
  
judge:
  model: phi4-judge  # ✅ phi4 is judge only
```

### 2. **Strict vision-specific criteria**

```yaml
criteria: "Must describe SPECIFIC visual elements actually present in the image. Generic descriptions without visual details score 0."
```

**Key changes:**
- "SPECIFIC" - not generic
- "actually present" - must see the image
- "score 0" - explicit failure condition

### 3. **Better rubric weights**

```yaml
rubric:
  accuracy: 0.6      # Up from 0.5
  completeness: 0.3  # Same
  conciseness: 0.1   # Down from 0.2
```

**Reasoning:**
- Accuracy (seeing correctly) most important
- Conciseness less important (detailed descriptions are good)

---

## 📋 Checklist for Vision Evals

Before running a vision eval:

- [ ] ✅ ALL models in the eval have vision capability
- [ ] ✅ Criteria explicitly requires seeing the image
- [ ] ✅ Criteria penalizes generic/non-visual responses
- [ ] ✅ Judge is separate from eval models
- [ ] ✅ Test with 1-2 questions first
- [ ] ✅ Manually inspect results before publishing

---

## 🎯 Good vs Bad Criteria

### ❌ BAD (too generic):
```yaml
criteria: "Describes the scene accurately"
```
**Problem:** "Here's how to describe scenes" passes

### ✅ GOOD (specific):
```yaml
criteria: "Must describe SPECIFIC visual elements actually present in the image. Generic descriptions without visual details score 0."
```
**Why better:** Explicit requirement to SEE the image

### ❌ BAD (no penalty):
```yaml
criteria: "Identifies objects in the image"
```
**Problem:** No penalty for not identifying

### ✅ GOOD (explicit penalty):
```yaml
criteria: "Must name SPECIFIC objects visible in THIS image. Cannot score if model admits it cannot see the image."
```
**Why better:** Failure condition stated

---

## 🔬 How to Verify Vision Capability

### Manual check before eval:

```bash
# Test if a model can actually see images
ollama run llava:13b "What do you see in this image?" < test.jpg

# Should describe the image, not say "I can't see images"
```

### Automated check:

```yaml
# Add a vision capability test case
- id: vision-sanity-check
  prompt: "Can you see this image? Describe it."
  image: "test-images/simple-object.jpg"
  criteria: "Must describe the object. Scores 0 if admits cannot see images."
```

---

## 📊 Expected Results

### With fixed eval:

**Vision models:**
- llava-13b: Describes actual image content → HIGH score
- llama-vision: Describes (or attempts) → MED/HIGH score

**Text-only models (should NOT be included):**
- phi4: "I cannot see images" → Would score 0

---

## 🚀 Next Steps

1. ✅ Created `verdict-vision-only.yaml` (vision models only)
2. ✅ Created `vision-comprehensive-fixed.yaml` (strict criteria)
3. ⏳ Running fixed eval now
4. 📝 Will document results and compare to broken eval

---

## 💡 Key Takeaway

**"Helpful" != "Correct" for vision tasks!**

A text-only model giving helpful advice about describing images is:
- ✅ Helpful for a human
- ❌ Wrong for a vision benchmark
- ❌ Should score 0/10

**Vision benchmarks must require SEEING the image!**

---

**Last updated:** 2026-04-01  
**Status:** Fixed and re-running
