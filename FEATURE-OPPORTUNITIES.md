# Feature Opportunities for Full Compound Workflow Test

**Goal:** Pick a real feature to build using ce:plan → ce:work → ce:review → ce:compound

**Criteria:**
- Small enough to complete in 1-2 hours
- Valuable enough to be worth building
- Complex enough to test the workflow
- Fits verdict project scope

---

## Option 1: Auto-Contribute After Eval ✅ RECOMMENDED

**What:** Automatically contribute successful eval results to dashboard

**Why it's perfect:**
- ✅ We already have the plan (docs/plans/auto-contribute-plan.md)
- ✅ Clear requirements (TEST-FEATURE.md)
- ✅ Moderate complexity (config + API call)
- ✅ Immediately useful (saves manual step)
- ✅ Tests full workflow (plan exists, ready for work)

**Estimated time:** 2-3 hours implementation

**Value:** Eliminates manual contribution step, keeps dashboard fresh

**Workflow:**
1. ✅ ce:plan - Already done!
2. ce:work - Implement the feature
3. ce:review - 14 agents check our work
4. ce:compound - Capture learnings

---

## Option 2: Eval Pack Auto-Discovery

**What:** CLI command to discover eval packs from public repos/registries

**Why:**
- Useful for users finding evals
- Moderate complexity (HTTP fetch + parse)
- Expands verdict ecosystem

**Estimated time:** 3-4 hours

**Workflow:**
1. ce:brainstorm - What should discovery do?
2. ce:plan - How to fetch/parse/display packs
3. ce:work - Implement
4. ce:review + ce:compound

**Downside:** Requires brainstorming first, adds time

---

## Option 3: Dashboard Live Preview

**What:** Local server that auto-refreshes dashboard when new results added

**Why:**
- Immediate feedback during eval runs
- Shows dashboard without GitHub Pages delay
- Good for testing

**Estimated time:** 2-3 hours

**Workflow:**
1. ce:plan - Design live-reload mechanism
2. ce:work - Implement server + watch
3. ce:review + ce:compound

**Downside:** More frontend/server work, less backend/CLI

---

## Option 4: Judge Comparison Mode

**What:** Run same eval with different judges, compare score distributions

**Why:**
- Tests judge bias (phi4 vs qwen3 vs haiku)
- Validates our finding that judges matter
- Research value

**Estimated time:** 2-3 hours

**Workflow:**
1. ce:plan - Multi-judge execution strategy
2. ce:work - Implement comparison logic
3. ce:review + ce:compound

**Interesting:** Would prove/disprove judge bias hypothesis

---

## Option 5: Model Cost Tracking

**What:** Track and report actual API costs per eval run

**Why:**
- Users want to know costs
- Cloud models have real expense
- Dashboard could show cost/quality trade-offs

**Estimated time:** 2-3 hours

**Workflow:**
1. ce:plan - Cost calculation per provider
2. ce:work - Implement tracking + display
3. ce:review + ce:compound

**Downside:** Requires provider pricing data

---

## Recommendation: Option 1 (Auto-Contribute)

### Why This Is The Best Choice:

**1. Plan Already Exists**
- ce:plan was already completed (docs/plans/auto-contribute-plan.md)
- Can jump straight to ce:work
- Tests workflow from middle step

**2. Clear Implementation Path**
- Modify 2 files (schema.ts, run.ts)
- Add config option
- Call existing contribute function
- Well-scoped, no unknowns

**3. Immediately Useful**
- We use verdict daily
- Auto-contribution saves manual step
- Dashboard stays fresh automatically

**4. Right Complexity**
- Not trivial (touches config, CLI, API)
- Not too complex (no new architecture)
- Perfect for testing full workflow

**5. Tests Real Value of Compound Engineering**
- Plan quality (already validated)
- ce:work execution (worktrees, tracking)
- ce:review finding issues (14 agents)
- ce:compound capturing lessons

### Implementation Steps:

**Step 1: Review Plan** (5 min)
- Read docs/plans/auto-contribute-plan.md
- Confirm decisions still make sense
- Check for any gaps

**Step 2: ce:work** (90-120 min)
- Create git worktree
- Implement config schema changes
- Add auto-contribute logic
- Write tests
- Run quality checks

**Step 3: ce:review** (10-15 min)
- Spawn 14 reviewer agents
- Review findings
- Apply auto-fixes
- Address P1 issues

**Step 4: ce:compound** (15-20 min)
- Capture what worked
- Document challenges
- Update CLAUDE.md
- Create solution doc

**Total:** ~2.5-3 hours

---

## Alternative: Option 4 (Judge Comparison)

If you want something more research-focused:

**Judge Comparison Mode** would:
- Prove judge bias exists (or doesn't!)
- Generate interesting data
- Test multi-execution orchestration
- Create publishable findings

**But requires:**
- More upfront planning (no existing plan)
- Research mindset (not just feature building)
- Data analysis after

**Better for:** Next session after we validate workflow on Option 1

---

## Decision Matrix

| Feature | Plan Ready | Time | Value | Complexity | Test Workflow |
|---------|-----------|------|-------|------------|---------------|
| **Auto-Contribute** | ✅ Yes | 2-3h | High | Medium | ✅ Perfect |
| Eval Discovery | ❌ No | 3-4h | Medium | Medium | ⚠️ Adds brainstorm |
| Live Preview | ❌ No | 2-3h | Medium | High | ⚠️ Different skillset |
| Judge Comparison | ❌ No | 2-3h | Research | Medium | ✅ Good |
| Cost Tracking | ❌ No | 2-3h | Medium | Medium | ✅ Good |

---

## Recommendation

**Build:** Auto-Contribute After Eval (Option 1)

**Why:**
1. Plan exists (can jump to ce:work immediately)
2. Clear, well-scoped implementation
3. Immediately useful (saves manual step daily)
4. Perfect complexity for testing workflow
5. Tests all 4 stages (plan ✅, work, review, compound)

**Next steps:**
1. Review existing plan
2. Invoke ce:work in OpenClaw
3. Follow ce:work's guided implementation
4. ce:review before submitting
5. ce:compound to capture learnings

---

**Ready to build?** Run this in OpenClaw:

```bash
cd ~/.openclaw/ren-workspace/verdict
ce:work docs/plans/auto-contribute-plan.md
```

This will:
- Create git worktree
- Guide implementation step-by-step
- Run quality checks
- Prepare for ce:review

---

**Status:** Recommendation ready  
**Choice:** Option 1 - Auto-Contribute  
**Next:** Invoke ce:work in OpenClaw
