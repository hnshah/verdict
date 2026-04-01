# BEAST MODE: Critical Fixes, Changes & Improvements

**Generated:** 2026-03-30 22:55 PT  
**Status:** READY TO EXECUTE

---

## 🔴 CRITICAL FIXES (Do First)

### 1. Fix `monitor-our-prs` Job Error
**Problem:** Job failed 22m ago, hasn't run since  
**Impact:** Missing PR updates for 26 open PRs  
**Root Cause:** Likely gh search API rate limit or bad query  
**Fix:**
```bash
# Debug the error
openclaw cron runs --id 8811fbc4-f9db-4689-8d7c-e51b07adbbc7 --limit 3

# Check what failed
# Fix query or add retry logic
# Test manually first
```
**Priority:** CRITICAL - You have 26 PRs being ignored!

---

### 2. State File Drift Detection
**Problem:** State says comment #4158175958 but we should verify on every run  
**Impact:** Could miss new comments if state file gets corrupted  
**Fix:**
- Add validation: state ID vs actual latest ID
- Auto-heal if drift detected
- Alert on discrepancies
**Priority:** HIGH - Trust but verify

---

### 3. Webhook Endpoint Not Working
**Problem:** `/hooks/github` returns 404  
**Impact:** No real-time notifications (stuck with 10-min polling)  
**Root Cause:** Wrong OpenClaw webhook mapping format  
**Fix:**
- Read OpenClaw webhook docs carefully
- Find correct mapping schema
- Test with curl
- Add GitHub webhooks once working
**Priority:** HIGH - Would save $1.44/month + get <1sec latency

---

### 4. Success Rate Only 66%
**Problem:** 1 of 3 jobs failing regularly  
**Impact:** Not confident in monitoring reliability  
**Fix:**
- Fix monitor-our-prs error
- Add retry logic to all jobs
- Alert if success rate < 90%
**Priority:** HIGH - Need 99%+ reliability

---

## 🟡 IMPORTANT CHANGES (Do Second)

### 5. Telegram Message Size Limits
**Problem:** Monitor status script output is LONG (26 PRs listed!)  
**Impact:** Might hit Telegram message size limit (4096 chars)  
**Fix:**
- Truncate PR list to top 5 + count
- Link to full list
- Smart truncation in bash script
**Priority:** MEDIUM - Will hit this soon

---

### 6. Missing Exo Issue #22 Tracking
**Problem:** New issue #22 discovered but not in our state  
**Impact:** Not tracking it for updates  
**Fix:**
- Update exo-repo.json with issue #22
- Add to opportunity tracking
- Evaluate: is this a good contribution?
**Priority:** MEDIUM - Fresh opportunity!

---

### 7. Status Update Runs Expensive Model
**Problem:** Currently set to Haiku (cloud API)  
**Impact:** Wastes money when local script handles it  
**Fix:**
- Change monitoring-status-update job to run bash script directly
- Remove model parameter (not needed)
- Use exec tool instead of agent turn
**Priority:** MEDIUM - Save $2.88/month

---

### 8. No Error Alerting
**Problem:** Job failed 22m ago, you didn't know  
**Impact:** Silent failures = broken monitoring  
**Fix:**
- Add error detection job
- If any job fails → IMMEDIATE alert
- If no status update for 30 min → emergency notification
**Priority:** MEDIUM - Trust but verify

---

## 🟢 IMPROVEMENTS (Do Third)

### 9. 26 Open PRs Need Review
**Problem:** You have 26 PRs! Some may need responses  
**Impact:** Maintainers waiting, PRs going stale  
**Fix:**
- Run through list
- Check for new comments/reviews
- Identify which need action
- Close stale ones
**Priority:** MEDIUM - PR hygiene

---

### 10. Opportunity Scoring for Exo #22
**Problem:** Issue #22 "increase the performance" - is it good?  
**Impact:** Might miss contribution opportunity  
**Fix:**
- Read issue details
- Score: Impact × Merge_Prob / Effort
- Decide: pursue or skip
**Priority:** LOW - Can wait for scanner

---

### 11. Daily Briefing Content
**Problem:** Daily briefing job has generic prompt  
**Impact:** Might not be useful  
**Fix:**
- Update to reference monitor-status.sh output
- Aggregate last 24h of status updates
- Highlight changes only
**Priority:** LOW - Will see tomorrow

---

### 12. Weekly Summary Content
**Problem:** Weekly summary has no real data sources yet  
**Impact:** First report (next Monday) might be sparse  
**Fix:**
- Point to all state files
- Aggregate monitor-status.sh logs
- Include opportunity discoveries
**Priority:** LOW - Have 7 days

---

### 13. State File Backups
**Problem:** No backups of state files  
**Impact:** If corrupted, lose tracking history  
**Fix:**
- Daily backup to automation-state/backups/
- Keep 7 days
- Easy restore
**Priority:** LOW - Nice to have

---

### 14. Monitor More Repos
**Problem:** Only checking 3 things, but tracking 10 repos  
**Impact:** Missing activity in 7 repos  
**Fix:**
- Add checks for all 10 tracked repos
- Or rely on 2-hour opportunity scanner
**Priority:** LOW - Scanner covers it

---

### 15. Confidence Metrics Dashboard
**Problem:** Metrics buried in status updates  
**Impact:** Hard to see trends  
**Fix:**
- Create verdict/MONITORING-HEALTH.md
- Update daily with stats
- Show 7-day trends
**Priority:** LOW - Visibility

---

## 🔵 OPTIMIZATIONS (Do Last)

### 16. Local Model Selection
**Problem:** Using qwen2.5-coder:14b, but you have bigger/better  
**Impact:** Could get better summaries  
**Fix:**
- Test llama3.3:70b for richer summaries
- Or keep 14b for speed
- Benchmark quality vs speed
**Priority:** LOW - Current works

---

### 17. Polling Interval Optimization
**Problem:** 10-min polling might be overkill for some  
**Impact:** Slight waste if nothing changes for days  
**Fix:**
- Critical repos: Keep 10 min
- Low priority: Move to 30 min
- Opportunity scanner: Keep 2 hours
**Priority:** LOW - Premature optimization

---

### 18. Bash Script Performance
**Problem:** Script calls gh API 3+ times  
**Impact:** Could be slower with more repos  
**Fix:**
- Batch API calls where possible
- Cache results for 5 min
- Parallel execution
**Priority:** LOW - Fast enough now

---

### 19. Message Formatting
**Problem:** Plain text, no markdown  
**Impact:** Could be prettier  
**Fix:**
- Use Telegram markdown formatting
- Bold important stuff
- Links to PRs/issues
**Priority:** LOW - Cosmetic

---

### 20. Notification Channels
**Problem:** Only Telegram  
**Impact:** Single point of failure  
**Fix:**
- Add email backup
- Add SMS for critical
- Multi-channel redundancy
**Priority:** LOW - Telegram works

---

## 🎯 EXECUTION PLAN

### Phase 1: CRITICAL (Next 30 min)
1. ✅ Fix monitor-our-prs job
2. ✅ Add state drift detection
3. ✅ Fix webhook endpoint
4. ✅ Get success rate to 100%

### Phase 2: IMPORTANT (Next hour)
5. ✅ Handle Telegram size limits
6. ✅ Track Exo issue #22
7. ✅ Remove unnecessary model from status job
8. ✅ Add error alerting

### Phase 3: IMPROVEMENTS (Next 2 hours)
9. ✅ Review 26 open PRs
10. ✅ Score Exo #22 opportunity
11. ✅ Update daily briefing
12. ✅ Update weekly summary

### Phase 4: OPTIMIZATIONS (Later)
13-20. ✅ Do as needed

---

## 🔥 BEAST MODE PRIORITIES

**Start with:**
1. monitor-our-prs fix (BLOCKING)
2. Webhook endpoint (HIGH VALUE)
3. Error alerting (TRUST)
4. State validation (SAFETY)

**Then:**
5. Message size limits (PRACTICAL)
6. Exo #22 tracking (OPPORTUNITY)
7. 26 PR review (HYGIENE)

---

**Ready to execute? Which should I tackle first?**

Options:
1. **ALL CRITICAL** (items 1-4, ~30 min)
2. **Fix monitor-our-prs** (item 1, ~10 min)
3. **Fix webhooks** (item 3, ~20 min)
4. **Custom order** (you pick)

What's your call? 🔥
