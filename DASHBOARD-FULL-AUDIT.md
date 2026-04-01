# Dashboard Full Audit - 2026-04-01 20:42 PT

**Requested by:** Hiten  
**Scope:** Complete dashboard review

---

## 🔍 Issues Found

### 1. ❌ HuggingFace Links Are 404

**Problem:** Model pages link to `https://huggingface.co/MODEL-NAME`

**Example:**
- llava-13b links to: `https://huggingface.co/llava-13b` ❌ 404!
- Should link to: `https://huggingface.co/liuhaotian/llava-v1.5-13b` ✅

**Root Cause:**
- Dashboard assumes HuggingFace models are at `huggingface.co/{model-id}`
- But most models are at `huggingface.co/{org}/{model-name}`
- Need proper HuggingFace org/model mapping

**Affected Models:** ALL models with HuggingFace links

**Fix Needed:**
- Create model ID → HuggingFace URL mapping
- OR remove HuggingFace links if we can't map them accurately
- OR link to Ollama library instead

---

### 2. ❌ Broken Vision Run (Run 2)

**Problem:** Run 2 has invalid scoring

**URL:** https://hnshah.github.io/verdict/runs/2026-04-01-2026-04-01T03-19-27/

**Issue:**
- phi4 (text-only): 8.5/10 (70% win) ❌
- llava-13b (vision): 8.0/10 (30% win) ❌
- phi4 CAN'T SEE IMAGES but scored higher!

**Status:** Documented in VISION-EVAL-LESSONS.md  
**Fix:** Already created fixed version (Run 3)

**Action Needed:** Flag this run as invalid on dashboard

---

### 3. ⚠️ Dashboard May Not Show Latest Run

**Problem:** Dashboard might not have auto-updated

**Expected:** 13 runs (10 text + 3 vision)  
**Currently Showing:** Need to verify

**Runs Should Include:**
- 10 text-only evals from 2026-03-31
- 3 vision evals from 2026-04-01

**Action:** Check if GitHub Action ran and committed HTML

---

## 🔍 Full Content Audit

### Vision Runs (3 total)

| Run | Time | Models | Winner | Score | Status |
|-----|------|--------|--------|-------|--------|
| 1 | 03:18 | llava, llama-vision, phi4 | llava-13b | 9.1/10 | ✅ GOOD |
| 2 | 03:19 | llava, phi4 | phi4 | 8.5/10 | ❌ BROKEN |
| 3 | 03:35 | llava, llama-vision, phi4-judge | llava-13b | 7.0/10 | ✅ FIXED |

---

### Text Runs (10 total)

All appear to be working correctly based on earlier review.

---

## 🔧 Required Fixes

### Priority 1: HuggingFace Links

**Option A: Remove HuggingFace links** (FASTEST)
```javascript
// In model page generator, comment out HF link
// Just show Ollama library link instead
```

**Option B: Create mapping file** (BETTER)
```yaml
# model-to-hf.yaml
llava-13b: liuhaotian/llava-v1.5-13b
llama3.2-vision:11b: meta-llama/Llama-3.2-11B-Vision
qwen2.5-vl:7b: Qwen/Qwen2.5-VL-7B
# etc...
```

**Option C: Link to Ollama instead** (EASIEST)
```
https://ollama.com/library/llava:13b
```

**Recommendation:** Option C (Ollama links) - Most reliable

---

### Priority 2: Flag Broken Run

**Add warning to Run 2 page:**
```html
<div class="warning">
  ⚠️ This run has invalid scoring. A text-only model (phi4) 
  was included in a vision benchmark and scored higher than 
  vision models. See the fixed version (Run 3).
</div>
```

---

### Priority 3: Verify Auto-Regeneration

**Check if GitHub Action is working:**
1. Go to https://github.com/hnshah/verdict/actions
2. Check "Regenerate Dashboard" workflow
3. Verify it ran after we pushed the new JSON
4. Verify it committed the HTML

---

## 📊 Dashboard Health Check

### ✅ Working:
- Main dashboard loads
- Run pages load
- Model pages load
- Leaderboard shows correct data
- All JSON files present
- Dashboard generation script works

### ❌ Broken:
- HuggingFace links (404)
- Run 2 scoring (invalid)

### ⚠️ Unknown:
- GitHub Action auto-regeneration status
- Whether latest run (Run 3) is visible

---

## 🎯 Action Items

**Immediate:**
1. Fix HuggingFace links (use Ollama links instead)
2. Verify Run 3 is visible on live dashboard
3. Check GitHub Actions workflow status

**Soon:**
4. Add warning to Run 2 page
5. Update model page template with correct links
6. Test full auto-regeneration flow

**Later:**
7. Create proper HuggingFace model mapping
8. Add model source links (GitHub, HF, Ollama)
9. Improve model page metadata

---

## 🔬 Verification Steps

1. ✅ Model pages load (tested llava-13b)
2. ⏳ HuggingFace links work (FAILED - 404)
3. ⏳ Latest run visible (CHECKING)
4. ⏳ GitHub Action ran (CHECKING)
5. ⏳ All 13 runs present (CHECKING)

---

**Next:** Fix HuggingFace links and verify dashboard is complete
