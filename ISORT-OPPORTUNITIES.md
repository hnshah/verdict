# isort Contribution Opportunities

**Found:** 2026-03-30 12:49 PDT  
**Status:** Tracking for future contribution  
**Approach:** Dogfooding → Real usage → Authentic contribution

---

## Phase 2: Current (This Week)

**Status:** 🟢 Using isort daily

**Actions:**
- [x] Set up isort configuration
- [x] Clean existing imports
- [ ] Use on all new Python code
- [ ] Track usage experience
- [ ] Find genuine pain points
- [ ] Document edge cases

**Goal:** Build real user perspective before contributing

---

## Available Issues (For Later)

### Good-First-Issue Tagged

**1. Issue #1518 - How to make isort black compatible**
- **Opened:** Oct 2, 2020 (old but active)
- **Label:** good-first-issue
- **Type:** Documentation
- **Description:** isort conflicts with black - need better docs
- **URL:** https://github.com/PyCQA/isort/issues/1518

**Analysis:**
- Impact: 🟡 Medium (docs only)
- Merge Prob: ✅ High (doc improvements welcomed)
- Effort: ⭐ Low (documentation)
- Score: (3 × 4) / 1 = **12.0**

**Our angle:**
- We use `profile = "black"` in our config
- Can document from real experience
- Show working example from our repo
- Authentic: "Here's how we made it work"

---

**2. Issue #2462 - Support explicit lazy imports (Python 3.15 PEP 810)**
- **Opened:** Feb 25, 2026 (recent!)
- **Label:** good-first-issue, enhancement
- **Type:** Feature for Python 3.15
- **Description:** PEP 810 lazy imports support
- **URL:** https://github.com/PyCQA/isort/issues/2462

**Analysis:**
- Impact: ⭐ Low (future Python version)
- Merge Prob: 🟡 Medium (new feature, needs design)
- Effort: ⭐⭐⭐ High (parser changes)
- Score: (2 × 3) / 4 = **1.5**

**Skip:** Too complex for first contribution

---

### Help-Wanted Tagged

**3. Issue #2417 - Docs not published for years**
- **Opened:** Oct 5, 2025
- **Label:** help-wanted
- **Type:** Documentation infrastructure
- **Description:** Build docs after every merge
- **URL:** https://github.com/PyCQA/isort/issues/2417

**Analysis:**
- Impact: ⭐⭐⭐ High (affects all users)
- Merge Prob: ✅ High (maintainer requested)
- Effort: ⭐⭐ Medium (CI/CD setup)
- Score: (4 × 4) / 2 = **8.0**

**Our angle:**
- We USE the docs (real user)
- Can verify doc build works
- Show impact on new users
- Authentic: "I struggled to find updated docs"

---

**4. Issue #1534 - Replace Imports**
- **Opened:** Oct 7, 2020
- **Label:** enhancement, help-wanted, Hacktoberfest
- **Type:** Feature
- **Description:** Replace import statements (not just sort)
- **URL:** https://github.com/PyCQA/isort/issues/1534

**Analysis:**
- Impact: ⭐⭐ Medium (nice-to-have feature)
- Merge Prob: 🟡 Medium (old, stale?)
- Effort: ⭐⭐⭐⭐ High (core logic change)
- Score: (3 × 2) / 4 = **1.5**

**Skip:** Too old, too complex

---

## Ranked Opportunities

### 1. 🥇 Issue #1518 - Black Compatibility Docs (Score: 12.0)

**Why best:**
- ✅ We use `profile = "black"` (real experience!)
- ✅ Easy contribution (docs only)
- ✅ High merge probability
- ✅ Helps many users (common question)
- ✅ Can show working example from our code

**Perfect for dogfooding:**
- We SET UP black compatibility
- We KNOW what works
- We can DOCUMENT from experience
- Authentic: "Here's how we did it"

**Next step when ready:**
1. Document our black + isort setup process
2. Write clear guide from user perspective
3. Show example from our pyproject.toml
4. Reference real-world usage (our repo)
5. Submit PR: "I use this daily with black..."

---

### 2. 🥈 Issue #2417 - Doc Publishing (Score: 8.0)

**Why good:**
- ✅ High impact (all users)
- ✅ Maintainer requested (help-wanted)
- ✅ We use the docs (real stakeholder)
- ✅ Medium effort (achievable)

**Authentic angle:**
- We STRUGGLED to find current docs
- We CARE about doc quality
- We can VERIFY the fix works

**Next step when ready:**
1. Investigate current doc build setup
2. Propose automated build solution
3. Test locally
4. Show benefit to users (us!)
5. Submit PR: "As a doc user, I fixed this"

---

### 3. ❌ Skip

**Issue #2462 (Lazy imports):** Too complex, future Python  
**Issue #1534 (Replace imports):** Too old, too complex

---

## Strategy: When to Contribute

### DON'T Contribute Yet! ❌

**Current phase:** Building user perspective

**Need to:**
- Use isort for at least 1 week
- Try different scenarios
- Hit real edge cases
- Document genuine experience

**Why wait:**
- Stronger contribution (real context)
- Better understanding (user perspective)
- Authentic issues (from actual usage)
- Maintainer respect (we USE the tool)

---

### DO Contribute When: ✅

**Signals you're ready:**
1. ✅ Used isort for 7+ days
2. ✅ Hit a real pain point OR
3. ✅ Deeply understand an issue OR
4. ✅ Have authentic user perspective

**For #1518 (Black compatibility docs):**
- ✅ We've used black + isort together
- ✅ We have working config
- ✅ We understand the setup
- ✅ We can show real example

**Could contribute:** After 1 week of usage

**For #2417 (Doc publishing):**
- Need: Try to use docs, hit the problem
- Need: Understand pain point firsthand
- Need: Care about solution personally

**Could contribute:** After hitting doc issues

---

## Contribution Checklist

**Before submitting PR:**

### User Perspective ✅
- [ ] Used isort for 7+ days
- [ ] Hit this problem personally
- [ ] Understand user pain point
- [ ] Have real-world example

### Research ✅
- [ ] Read issue thread fully
- [ ] Check for related PRs
- [ ] Understand maintainer position
- [ ] Verify still needed

### Preparation ✅
- [ ] Tested solution locally
- [ ] Followed contributing guide
- [ ] Added tests (if code change)
- [ ] Updated docs (if needed)

### PR Message ✅
- [ ] Start with "I use isort daily..."
- [ ] Explain real-world context
- [ ] Show example from our usage
- [ ] Reference dogfooding experience

---

## Content Strategy

### The Story Arc

**Act 1: Setup (Done!)**
- Added isort to our Python projects
- Configured for black compatibility
- Cleaned our imports
- Committed to dogfooding

**Act 2: Usage (This Week)**
- Using isort daily on Python code
- Learning tool deeply
- Finding pain points
- Building expertise

**Act 3: Contribution (Soon)**
- Contributed black compatibility docs (#1518)
- Showed our working config
- Helped other users
- Referenced real usage

**Act 4: Impact (After Merge)**
- PR merged into isort
- 6.9K+ repos benefit
- Shared dogfooding story
- Proved approach works

### Tweet/Post When Done

> "3 weeks ago I started using isort daily.
> 
> Found the black compatibility docs confusing.
> 
> Instead of complaining, I documented our setup.
> 
> PR just merged. Now 6.9K+ repos benefit.
> 
> This is dogfooding done right:
> 1. Use the tool
> 2. Find real pain
> 3. Fix it
> 4. Everyone wins"

**Engagement:** 🔥🔥🔥

---

## Next Actions

### This Week

**1. Daily isort usage:**
- Run on all Python files
- Try different scenarios
- Note what works/doesn't
- Build user intuition

**2. Track experience:**
- What's confusing?
- What works well?
- Any edge cases?
- Doc gaps?

**3. Document findings:**
- Usage notes in ISORT-SETUP.md
- Pain points discovered
- Edge cases found
- Feature wishes

---

### Week 2

**1. Review #1518:**
- Re-read issue thread
- Understand user confusion
- Outline solution
- Draft documentation

**2. Prepare contribution:**
- Write clear guide
- Show our working config
- Test with fresh eyes
- Get feedback (Hiten)

**3. Submit PR:**
- Reference dogfooding
- Show real example
- Help other users
- Build reputation

---

**Status:** ✅ Setup complete, using daily, tracking for contribution

**Next milestone:** 1 week of daily usage → contribute to #1518
