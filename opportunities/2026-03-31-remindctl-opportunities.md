# remindctl - Apple Reminders CLI Tool

**Repo:** steipete/remindctl  
**Stars:** 180  
**Created:** 2026-01-03 (Brand new!)  
**Last Push:** 2026-01-11  
**Open Issues:** 13  
**Assessed:** 2026-03-31 00:33 PT

---

## Repository Health

**Activity:** ✅ Very Active
- Brand new (Jan 2026)
- 13 open issues with active discussion
- Multiple contributors
- Clear feature requests with user engagement

**Community:** ✅ Growing Fast
- 180 stars in 3 months
- Active issue discussions
- Real user pain points
- Users voting with reactions (👍)

**Maintainer:** steipete (Peter Steinberger - well-known iOS developer)

**Technology:** Swift (EventKit for macOS Reminders)

---

## Top Opportunities

### 1. Issue #6: Support for all-day reminders (date-only, no time)
**Created:** 2026-01-16  
**Comments:** 3 (active engagement!)  
**Reactions:** 6 👍  
**Status:** PR #24 submitted but needs work

**Problem:**
- Date-only reminders get midnight time (00:00)
- Users want true all-day reminders (no time)
- Default behavior causes confusion

**User quote:**
> "I use date-only reminders as my default workflow and the midnight time causes confusion. Would love either an `--all-day` flag or making date-only the default when no time is specified." (5 👍)

**Opportunity Score:**

**Impact: 4/5**
- High engagement (6 reactions)
- Common use case (date-only reminders)
- Affects default behavior
- Clear user pain point

**Merge Probability: 5/5** ⭐
- PR already submitted (#24)!
- Shows maintainer receptive
- Clear feature request
- Real users asking for it

**Effort: 2/5** (LOW = better!)
- PR exists to learn from
- EventKit API straightforward
- Boolean flag implementation
- Clear specification

**Score:** (4 × 5) / 2 = **10.0/10**

**Rating:** 🥇 **EXCELLENT**

**Why This Is Great:**
1. ✅ PR #24 exists (can improve/fix it)
2. ✅ Clear user demand (6 reactions)
3. ✅ Low complexity (flag + API call)
4. ✅ We can TEST it (we use Reminders!)
5. ✅ Clear acceptance criteria

---

### 2. Issue #28: SwiftLint type_body_length warning
**Created:** 2026-02-17  
**Comments:** 1 (author)  
**Author:** philoserf

**Problem:**
- SwiftLint warning in EventKitStore.swift
- Code quality issue
- "Existing lint noticed upon first examination of source"

**Opportunity Score:**

**Impact: 2/5**
- Code quality (not user-facing)
- Lint warning (low urgency)
- But: shows code needs refactoring

**Merge Probability: 5/5**
- Clear problem
- Straightforward fix
- Maintainer likely to accept code quality

**Effort: 2/5** (LOW)
- Refactor long function
- Standard Swift refactoring
- No new functionality

**Score:** (2 × 5) / 2 = **5.0/10**

**Rating:** 🥈 **GOOD**

**Why Consider:**
- Easy fix (refactoring)
- Shows code quality focus
- Good first contribution

---

### 3. Issue #32: edit --due silently fails to update due date/time
**Created:** 2026-02-24  
**Comments:** 1 ("Yes noticing the same thing!")  
**Status:** Bug

**Problem:**
- `edit --due` command fails silently
- No error message, just doesn't work
- Broken core functionality

**Opportunity Score:**

**Impact: 4/5**
- Core functionality broken
- Silent failure (bad UX)
- Active users hitting it

**Merge Probability: 5/5**
- Clear bug
- Reproducible
- High priority fix

**Effort: 3/5** (MEDIUM)
- Need to debug why it fails
- EventKit date handling
- Error handling

**Score:** (4 × 5) / 3 = **6.7/10**

**Rating:** 🥈 **GOOD**

**Why Consider:**
- Bug fix (high merge probability)
- Improve UX (error messages)
- Real users affected

---

### 4. Issue #31: list command silently ignores multiple list names
**Created:** 2026-02-22  
**Comments:** 0  
**Status:** Bug

**Problem:**
- Pass multiple list names → only first is used
- Silent failure (no error)
- Unexpected behavior

**Opportunity Score:**

**Impact: 3/5**
- Edge case (multiple lists)
- But: silent failure = bad UX

**Merge Probability: 5/5**
- Clear bug
- Easy to reproduce

**Effort: 2/5** (LOW)
- Either: support multiple lists
- Or: error message for multiple

**Score:** (3 × 5) / 2 = **7.5/10**

**Rating:** 🥈 **GOOD**

---

### 5. Issue #23: edit --due with date-only sets hour:0 minute:0
**Created:** 2026-02-04  
**Comments:** 0  
**Status:** Related to #6

**Problem:**
- Same as #6 but for edit command
- Date-only becomes midnight

**Score:** (4 × 5) / 2 = **10.0/10** (tied with #6)

**Rating:** 🥇 **EXCELLENT**

**Note:** Could be fixed together with #6!

---

## Issues to Skip

### #42: Support for Reminder sections (Posted yesterday!)
- **New feature** (groups within lists)
- **Higher effort** (new UI concept)
- Wait to see maintainer response

### #18: Support Tags and Smart Lists
- **API Limitation:** Tags not exposed by Apple EventKit
- **Not implementable** without workarounds
- Skip unless we find creative solution

### #15: Add --urgent flag
- **API Limitation:** No urgent/alarm API
- **Not implementable** (multiple users confirmed)
- Skip

### #16: Location-based triggers
- **High effort** (location services)
- **Complex** (background location)
- Skip for first contribution

### #19: add silently fails
- Need more details to debug
- Could be environmental
- Skip until reproduced

### #5: authorize doesn't trigger prompt
- Terminal.app vs Warp.app issue
- Environment-specific
- Workaround exists
- Skip

---

## Recommended Contribution Path

### **First PR: Fix Issue #6 + #23 (All-Day Reminders)**

**Plan:**
1. Fork & clone remindctl
2. Review PR #24 (existing attempt)
3. Implement improved solution:
   - Add `--all-day` flag to `add` command
   - Add `--all-day` flag to `edit` command
   - Set `isDateOnly` property on EKReminder
   - Test date-only vs timed reminders
4. Write tests
5. Update documentation
6. Submit PR referencing #6 and #23

**Estimated Time:** 2-4 hours

**Why This Is Perfect:**
- ✅ Clear user demand (6 reactions)
- ✅ Existing PR to learn from
- ✅ We can dogfood it (we use Reminders!)
- ✅ Low complexity (Boolean flag)
- ✅ Fixes two issues at once
- ✅ High merge probability
- ✅ Great story ("I use Reminders daily and fixed the date-only issue")

---

### **Second PR: Fix Issue #32 (Silent Failure)**

After #6/#23 merged, tackle bug fix:

1. Reproduce the bug
2. Add error handling
3. Fix the underlying issue
4. Add proper error messages
5. Test edge cases

**Estimated Time:** 1-2 hours

---

### **Third PR: Fix Issue #31 (Multiple Lists)**

After establishing contribution pattern:

1. Decide: support multiple OR error message
2. Implement chosen solution
3. Add tests
4. Submit PR

**Estimated Time:** 1 hour

---

## Why remindctl Is Perfect

### **Dogfooding Opportunity:** ✅ EXCELLENT
- We USE Reminders daily
- We can TEST our changes immediately
- Real user perspective (not synthetic)
- Authentic pain points

### **Contribution Complexity:** ✅ LOW
- Swift (familiar)
- EventKit API (well-documented)
- Clear issues with specifications
- Existing PR to learn from

### **Maintainer Receptivity:** ✅ HIGH
- Active project (brand new)
- Clear feature requests
- PR #24 shows openness to contributions
- Real users engaging

### **Story Value:** ✅ HIGH
- "I fixed the tool I use every day"
- Date-only reminders = relatable problem
- Brand new tool (early contributor)
- Can showcase before/after

---

## Opportunity Comparison

| Opportunity | Score | Effort | Impact | Merge | Story |
|-------------|-------|--------|--------|-------|-------|
| **remindctl #6** | 10.0/10 | LOW | HIGH | HIGH | ⭐⭐⭐⭐⭐ |
| **isort #1518** | 12.0/10 | LOW | HIGH | HIGH | ⭐⭐⭐⭐⭐ |
| **MLX best** | 2.7/10 | HIGH | MED | MED | ⭐⭐ |
| **Exo #22** | 3.0/10 | HIGH | MED | HIGH | ⭐⭐ |

**remindctl is nearly as good as isort!**

---

## Recommendation

### **Pursue Both:**

**Week 1:** isort #1518 (documentation, already have comment posted)  
**Week 2:** remindctl #6+#23 (all-day reminders, clear implementation)

**Strategy:**
1. ✅ Continue isort #1518 (waiting for maintainer response)
2. ✅ Start remindctl #6+#23 (can work in parallel)
3. ✅ Dogfood both tools daily
4. ✅ Submit PRs based on real usage

**This gives us:**
- Two parallel contribution tracks
- Both are dogfooding opportunities
- Both have high merge probability
- Both have great story value
- Diversified risk (if one blocks, other continues)

---

## Action Items

**Immediate:**
1. ⏸️ Wait for isort #1518 maintainer response
2. ✅ Fork remindctl
3. ✅ Review PR #24
4. ✅ Test current all-day behavior
5. ✅ Implement improved solution

**This week:**
- Build fix for remindctl #6+#23
- Test with our actual Reminders workflow
- Submit PR when ready

---

**Status:** EXCELLENT opportunity, ready to pursue! 🚀
