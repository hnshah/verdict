# FINAL COMMENT - Ready to Post to Issue #1518

**URL:** https://github.com/PyCQA/isort/issues/1518

**Action:** Copy this text and post as a comment on the issue

---

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

## Instructions

1. Go to https://github.com/PyCQA/isort/issues/1518
2. Scroll to bottom (comment box)
3. Copy the text above (from "I hit this exact issue..." to end)
4. Paste into comment box
5. Click "Comment"

## What Happens Next

**Best case (likely):**
- Maintainer says "PR welcome!"
- We implement tomorrow
- Submit PR
- Merge in 2-7 days

**Good case:**
- Maintainer suggests modifications
- We adjust approach
- Implement their way

**Neutral case:**
- Maintainer says "maybe, thinking about it"
- We wait 48 hours
- Follow up if needed

**Response time:** Usually within 24 hours for active repos like isort

## After Posting

Let me know when you've posted it and I'll:
1. Monitor for maintainer response
2. Prepare PR implementation
3. Track the contribution
4. Update our dogfooding log

Ready to post! 🚀
