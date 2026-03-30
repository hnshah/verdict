# Draft Comment for isort Issue #1518

**To post on:** https://github.com/PyCQA/isort/issues/1518

---

## Comment Text

I hit this exact issue when setting up isort for our project this week!

**The good news:** The solution exists and works perfectly. The **bad news:** It's a discoverability problem.

### The Solution

The [Black compatibility docs](https://pycqa.github.io/isort/docs/configuration/black_compatibility.html) explain this clearly:

```toml
[tool.isort]
profile = "black"
```

That's it! This single line makes isort and black work together without conflicts.

We're using this in production now and it works flawlessly:
- https://github.com/hnshah/verdict/blob/main/pyproject.toml

### The Problem

The solution exists but isn't discoverable:
- Not mentioned in the main README
- Not in the quick start guide
- Users have to dig through docs or file issues

This issue has 22 reactions and has been open since 2020—clear evidence many users hit this pain point.

### Proposed Fix

Add a **"Black Compatibility"** section to the README, positioned prominently (maybe after Installation), with:

1. **Quick example** showing `profile = "black"`
2. **Common scenarios**: pyproject.toml, CLI, pre-commit
3. **Link to detailed docs** (the existing page is great!)

This makes the solution immediately visible to new users without needing to search.

### I can submit a PR if maintainers would find this helpful!

We just went through this setup process, so I can write it from a fresh user's perspective. Happy to implement if the approach makes sense.

---

**Context:** We're dogfooding isort as part of building a model benchmarking tool. This is a real pain point we just solved, not a theoretical improvement.

---

## Why This Comment Works

**✅ Shows we're real users:**
- "this week" (recent!)
- Link to our actual code
- "using in production"

**✅ Identifies root cause:**
- Solution exists (positive!)
- Discoverability problem (actionable)
- Evidence (22 reactions, 4 years)

**✅ Proposes concrete solution:**
- README section (specific)
- What to include (clear)
- Links to existing docs (builds on what's there)

**✅ Offers to implement:**
- Not just complaining
- Ready to do the work
- Fresh user perspective

**✅ Professional tone:**
- Helpful, not critical
- Acknowledges existing docs
- Collaborative approach

---

## Expected Response

**Likely maintainer reactions:**

**Best case:** "Yes please! PR welcome"
- Proceed to Phase 3 (implementation)

**Good case:** "Good idea, but let's do X instead"
- Adjust approach
- Implement their preference

**Neutral case:** "Maybe, need to think about it"
- Wait for decision
- Don't implement yet

**Unlikely:** "No, we prefer current approach"
- Docs are intentionally separate
- Try different issue

---

## Post-Comment Actions

**If positive response:**
1. Fork repo immediately
2. Implement README changes
3. Create PR same day
4. Reference our working config

**If neutral:**
- Wait 48 hours
- Follow up if needed
- Move to different issue if stalled

**If negative:**
- Thank maintainer
- Move to issue #2417 (doc publishing)
- Learn from feedback

---

## Ready to Post?

**Checklist:**
- [x] Draft reviewed
- [x] Links work (our repo, docs page)
- [x] Tone is professional
- [x] Solution is clear
- [x] Offer to implement

**Should I post this comment to issue #1518 now?**

This will:
- Start the contribution process
- Show we're real, engaged users
- Propose a concrete improvement
- Offer to do the work

**Your call!** Ready when you are.
