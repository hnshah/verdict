# OpenClaw Automation Strategy

**Goal:** Start small with GitHub PR/issue monitoring, then scale to larger automation workflows.

**Date:** 2026-03-30  
**Status:** Planning

---

## What OpenClaw Gives Us

### 1. Heartbeat (Every 30 min by default)

**What it is:**
- Runs in main session at regular intervals
- Agent checks HEARTBEAT.md checklist
- Batches multiple checks in one turn
- Context-aware (knows recent conversation)
- Smart suppression (HEARTBEAT_OK if nothing urgent)

**Best for:**
- Multiple periodic checks (inbox, calendar, notifications)
- Context-aware decisions
- Low-overhead monitoring
- Batching related checks

**Example:**
```md
# HEARTBEAT.md
- Check isort issue #1518 for maintainer response
- Check Exo repo for new issues
- If PR comment detected, analyze and contextualize
```

---

### 2. Cron Jobs (Precise scheduling)

**What it is:**
- Runs at exact times (5-field or 6-field cron)
- Can run isolated (fresh session) or in main session
- Model overrides per job
- One-shot support (`--at`)
- Automatic load spreading (top-of-hour stagger)

**Best for:**
- Exact timing ("9 AM every Monday")
- Standalone tasks
- Heavy analysis (different model)
- Noisy/frequent tasks
- One-shot reminders

**Example:**
```bash
openclaw cron add \
  --name "check-isort-1518" \
  --every "30m" \
  --session isolated \
  --message "Check isort #1518 for maintainer response. If response exists, analyze intent and prepare next steps." \
  --model haiku \
  --announce
```

---

### 3. Webhooks (External triggers)

**What it is:**
- HTTP endpoint for external systems
- `/hooks/wake` - trigger heartbeat with system event
- `/hooks/agent` - run isolated agent turn
- Custom mappings via `hooks.mappings`

**Best for:**
- GitHub webhook integration!
- Gmail notifications
- External system triggers
- Real-time event processing

**Security:**
- Requires token auth (`hooks.token`)
- Behind loopback/tailnet recommended
- Dedicated hook agent for isolation

---

### 4. Standing Orders (Permanent authority)

**What it is:**
- Defined in AGENTS.md or standing-orders.md
- Permanent operating authority for programs
- Clear scope, triggers, approval gates
- Pairs with cron for execution

**Best for:**
- Routine workflows ("you own the weekly report")
- Autonomous execution within boundaries
- Clear escalation rules
- Reducing human bottleneck

---

## GitHub PR/Issue Monitoring

### Use Case: Watch Repos for Activity

**Goal:**
- Monitor isort, Exo, and other repos we care about
- Detect new PRs, issues, comments
- Analyze and contextualize
- Surface relevant activity
- Auto-respond when appropriate

---

### Approach 1: Polling via Cron (Simple Start)

**How it works:**
1. Cron job runs every 30 min
2. Uses `gh` CLI to check for updates
3. Compares against last known state
4. If new activity → analyze and report

**Pros:**
- ✅ Simple to implement
- ✅ No external dependencies
- ✅ Works immediately
- ✅ Easy to debug

**Cons:**
- ⚠️ 30 min delay
- ⚠️ API rate limits (60/hour unauthed, 5000/hour authed)
- ⚠️ Polling overhead

**Implementation:**

```bash
# Cron job: Check isort #1518 every 30 min
openclaw cron add \
  --name "monitor-isort-1518" \
  --every "30m" \
  --session isolated \
  --message "
Check isort issue #1518 for new comments since last check.
Last checked: Store in verdict/automation-state/isort-1518-last-check.json
If new comments: 
  1. Read full comment
  2. Identify if from maintainer
  3. Analyze intent (approve / deny / question / discuss)
  4. Prepare response or next action
  5. Update state file
  6. Report to me via Telegram
" \
  --model haiku \
  --announce \
  --channel telegram
```

**State management:**
```json
{
  "repo": "PyCQA/isort",
  "issue": 1518,
  "lastChecked": "2026-03-30T21:04:47Z",
  "lastCommentId": 4158175958,
  "lastCommentAuthor": "hnshah",
  "status": "waiting-for-maintainer"
}
```

---

### Approach 2: GitHub Webhooks (Real-time)

**How it works:**
1. Configure GitHub webhook to send events to OpenClaw
2. OpenClaw receives POST to `/hooks/github`
3. Webhook mapping parses payload
4. Agent runs isolated turn to process
5. Reports findings

**Pros:**
- ✅ Real-time (no delay!)
- ✅ No polling overhead
- ✅ Only runs when needed
- ✅ Scales to many repos

**Cons:**
- ⚠️ Needs public endpoint (Tailscale Funnel / ngrok / VPS)
- ⚠️ More complex setup
- ⚠️ Security considerations

**GitHub Webhook Setup:**

1. **Expose OpenClaw endpoint:**
   ```bash
   # Option A: Tailscale Funnel (easiest)
   tailscale funnel 18789
   
   # Option B: ngrok
   ngrok http 18789
   
   # Option C: VPS reverse proxy
   # (nginx → OpenClaw gateway)
   ```

2. **Configure webhook in GitHub:**
   - Repo → Settings → Webhooks → Add webhook
   - Payload URL: `https://your-domain.com/hooks/github`
   - Content type: `application/json`
   - Secret: (matches `hooks.token`)
   - Events: Issues, Pull requests, Issue comments

3. **OpenClaw config:**
   ```json5
   {
     hooks: {
       enabled: true,
       token: "${GITHUB_WEBHOOK_SECRET}",
       path: "/hooks",
       mappings: [
         {
           name: "github",
           match: { source: "github" },
           action: "agent",
           agentId: "github-monitor",
           message: "Process GitHub webhook event",
           deliver: true,
           channel: "telegram"
         }
       ]
     }
   }
   ```

4. **Agent processes event:**
   ```
   Webhook payload → OpenClaw parses → Agent turn
   
   Agent analyzes:
   - Event type (issue_comment, pull_request, etc.)
   - Repository (is it one we care about?)
   - Author (maintainer? contributor?)
   - Content (what happened?)
   
   Agent decides:
   - Report to me?
   - Take action?
   - Store state?
   ```

---

### Approach 3: Hybrid (Recommended)

**Combine polling + webhooks:**

1. **Webhooks** for repos we actively contribute to
   - isort #1518 (waiting for response!)
   - Exo (new issues, PRs)
   - Any repo where we have open PRs

2. **Polling** for repos we're watching
   - Other OSS opportunities
   - Broader ecosystem monitoring
   - Lower priority repos

**Best of both:**
- ✅ Real-time for important repos
- ✅ Low overhead for watching
- ✅ Scales efficiently
- ✅ Fallback if webhooks fail

---

## Concrete Implementation Plan

### Phase 1: Simple Polling (This Week)

**Goal:** Monitor isort #1518 for maintainer response

**Implementation:**

1. **Create state directory:**
   ```bash
   mkdir -p ~/.openclaw/ren-workspace/verdict/automation-state
   ```

2. **Create state file:**
   ```json
   {
     "repo": "PyCQA/isort",
     "issue": 1518,
     "lastChecked": "2026-03-30T21:04:47Z",
     "lastCommentId": 4158175958,
     "status": "waiting"
   }
   ```

3. **Add cron job:**
   ```bash
   openclaw cron add \
     --name "check-isort-1518" \
     --every "30m" \
     --session isolated \
     --message "Check isort issue #1518.
   
   Steps:
   1. Read state from verdict/automation-state/isort-1518.json
   2. Use gh CLI: gh api /repos/PyCQA/isort/issues/1518/comments
   3. Find comments newer than lastCommentId
   4. If new comments exist:
      - Identify author (maintainer? contributor?)
      - Extract intent (approve/deny/question)
      - Prepare my response or next action
      - Update state file
      - Report via Telegram
   5. If no new comments: Update lastChecked, reply HEARTBEAT_OK
   " \
     --model haiku \
     --announce \
     --channel telegram
   ```

4. **Test:**
   ```bash
   openclaw cron list
   openclaw cron run check-isort-1518
   ```

**Expected behavior:**
- Runs every 30 min
- Checks for new comments
- If maintainer responds → notifies me immediately
- If no response → silent (HEARTBEAT_OK)
- Cheap (Haiku model)
- Reliable (gh CLI + state file)

---

### Phase 2: Generalize to Multiple Repos (Next Week)

**Extend to:**
- isort #1518 (existing)
- Exo repo (all issues/PRs)
- Any repo with open PRs from hnshah

**Implementation:**

1. **Create repos config:**
   ```json
   {
     "repos": [
       {
         "owner": "PyCQA",
         "repo": "isort",
         "track": [
           {
             "type": "issue",
             "number": 1518,
             "reason": "Our contribution",
             "notify": "telegram"
           }
         ]
       },
       {
         "owner": "ankitvgupta",
         "repo": "mail-app",
         "track": [
           {
             "type": "all-issues",
             "reason": "Potential contribution",
             "notify": "telegram"
           },
           {
             "type": "all-prs",
             "reason": "Monitoring activity",
             "notify": "none"
           }
         ]
       }
     ]
   }
   ```

2. **Single cron job for all:**
   ```bash
   openclaw cron add \
     --name "monitor-github-repos" \
     --every "30m" \
     --session isolated \
     --message "Monitor GitHub repos per config.
   
   Read verdict/automation-state/github-repos.json
   For each repo:
     1. Check configured trackers
     2. Detect new activity
     3. Analyze and prioritize
     4. Update state
     5. Notify if relevant
   
   Use haiku for analysis.
   Report summary to Telegram if anything important.
   " \
     --model haiku \
     --announce
   ```

---

### Phase 3: Add Webhooks (Week 2)

**Setup GitHub webhook for real-time:**

1. **Expose OpenClaw via Tailscale Funnel:**
   ```bash
   tailscale funnel 18789
   ```

2. **Configure webhook mapping:**
   ```json5
   {
     hooks: {
       enabled: true,
       token: "${GITHUB_WEBHOOK_SECRET}",
       mappings: [
         {
           name: "github",
           match: { path: "/hooks/github" },
           action: "agent",
           message: "Process GitHub event",
           agentId: "github-monitor",
           deliver: true,
           channel: "telegram"
         }
       ]
     }
   }
   ```

3. **Add webhook in GitHub:**
   - For each tracked repo
   - Payload URL: `https://your-funnel.ts.net/hooks/github`
   - Events: Issues, Pull requests, Issue comments

4. **Agent processes webhook:**
   - Receives event payload
   - Parses repo, issue/PR, author, content
   - Analyzes significance
   - Reports if relevant

---

### Phase 4: Standing Orders (Week 3)

**Define permanent authority for GitHub monitoring:**

Add to `AGENTS.md`:

```markdown
## Standing Order: GitHub Repository Monitor

**Authority:** Monitor configured GitHub repositories for activity relevant to our work

**Scope:**
- Track issues we've commented on
- Track PRs we've submitted
- Monitor repos we're contributing to
- Detect maintainer responses
- Analyze new issues in target repos

**Triggers:**
- Webhook: Real-time for tracked repos
- Cron: Every 30 min for polling repos
- Heartbeat: Check for escalations

**Approval Gates:**
- Commenting on issues: Require approval
- Opening PRs: Require approval
- Reading/analyzing: Autonomous

**Escalation:**
- Maintainer response on our issue/PR → Immediate notify
- New high-priority issue in target repo → Notify
- Unexpected repo activity → Report in summary
- API rate limit hit → Pause and notify

**Execution:**
1. Receive event (webhook or polling)
2. Parse and categorize
3. Check against tracking config
4. Analyze significance
5. Update state
6. Notify if relevant
7. Prepare response if needed (but wait for approval)

**State Management:**
- Store in verdict/automation-state/
- Track last seen activity per repo
- Maintain notification history
- Log all actions
```

---

## Example Workflows

### Workflow 1: isort PR Response Detection

**Trigger:** isort maintainer responds to #1518  
**Detection:** Cron polling every 30 min OR webhook (real-time)  
**Action:**

1. Detect new comment from maintainer
2. Analyze sentiment (approve / deny / question / request changes)
3. Extract action items
4. Prepare response draft (if approve)
5. Notify me via Telegram
6. Wait for my approval to post response

**Automation:**
```
Detection: Automated ✅
Analysis: Automated ✅
Draft preparation: Automated ✅
Response posting: Manual (requires approval) ⏳
```

---

### Workflow 2: Exo New Issue Discovery

**Trigger:** New issue opened in Exo repo  
**Detection:** Webhook (real-time)  
**Action:**

1. Receive webhook event
2. Parse issue (title, body, labels)
3. Analyze: Is this a contribution opportunity?
4. Score opportunity (similar to issue-discovery skill)
5. If high-value → notify me
6. If medium-value → add to tracking
7. If low-value → log only

**Automation:**
```
Detection: Automated ✅
Analysis: Automated ✅
Scoring: Automated ✅
Notification: Automated (conditional) ✅
Response: Manual ⏳
```

---

### Workflow 3: Weekly OSS Activity Summary

**Trigger:** Cron (every Monday 9 AM)  
**Action:**

1. Review all tracked repos
2. Summarize activity from past week
3. Highlight:
   - Our PRs (status, comments, merges)
   - New opportunities
   - Maintainer activity
   - Community engagement
4. Generate report
5. Send via Telegram

**Automation:**
```
Trigger: Automated ✅
Data collection: Automated ✅
Analysis: Automated ✅
Report generation: Automated ✅
Delivery: Automated ✅
```

---

## State Management

### Where to Store State

**Option 1: Git repo (verdict)**
```
verdict/automation-state/
├── github-repos.json (tracking config)
├── isort-1518.json (issue state)
├── exo-issues.json (issue tracking)
└── notifications-log.jsonl (history)
```

**Pros:**
- ✅ Version controlled
- ✅ Easy to inspect
- ✅ Portable
- ✅ Git history

**Cons:**
- ⚠️ Manual commits needed
- ⚠️ Merge conflicts possible

**Option 2: OpenClaw config directory**
```
~/.openclaw/ren-workspace/automation/
├── github-state.json
├── tracking-config.json
└── notifications.jsonl
```

**Pros:**
- ✅ Co-located with agent
- ✅ No git overhead
- ✅ Fast access

**Cons:**
- ⚠️ Not version controlled
- ⚠️ Less portable

**Recommendation:** Use verdict repo (Option 1)
- Commit state updates in automation commits
- Keep tracking config in git
- Use `.gitignore` for notification logs (too noisy)

---

## Cost Analysis

### Polling Approach

**Per repo per check:**
- API call: 1 request
- Agent turn: ~1000 tokens (haiku)
- Cost: ~$0.0001 per check

**30 min polling, 5 repos:**
- 48 checks/day × 5 repos = 240 checks/day
- Cost: ~$0.024/day = **$0.72/month**

**Very cheap!**

---

### Webhook Approach

**Per event:**
- Agent turn: ~2000 tokens (parsing + analysis)
- Cost: ~$0.0002 per event

**Estimated volume:**
- 10 events/day (new issues, comments, PRs)
- Cost: ~$0.002/day = **$0.06/month**

**Even cheaper!** (but only for active repos)

---

### Combined Approach

**Webhooks:** 5 high-priority repos = $0.06/month  
**Polling:** 10 watch-only repos = $0.24/month  
**Total:** ~$0.30/month = **Negligible cost!**

---

## Implementation Checklist

### Phase 1: isort #1518 Polling (Today)

- [ ] Create automation-state directory
- [ ] Create isort-1518.json state file
- [ ] Add cron job for polling
- [ ] Test cron job execution
- [ ] Verify Telegram notifications work
- [ ] Monitor for maintainer response

**Time:** 30 min  
**Complexity:** Low  
**Risk:** None

---

### Phase 2: Multi-Repo Monitoring (Next Week)

- [ ] Create github-repos.json config
- [ ] Generalize polling logic
- [ ] Add Exo repo tracking
- [ ] Test multi-repo checks
- [ ] Tune notification thresholds

**Time:** 2 hours  
**Complexity:** Medium  
**Risk:** Low

---

### Phase 3: Webhook Integration (Week 2)

- [ ] Set up Tailscale Funnel
- [ ] Configure webhook mapping
- [ ] Add GitHub webhooks
- [ ] Test webhook delivery
- [ ] Verify agent processing
- [ ] Compare webhook vs polling

**Time:** 3 hours  
**Complexity:** Medium  
**Risk:** Medium (public endpoint)

---

### Phase 4: Standing Orders (Week 3)

- [ ] Write standing orders in AGENTS.md
- [ ] Define approval workflows
- [ ] Set up escalation rules
- [ ] Test autonomous execution
- [ ] Refine based on actual use

**Time:** 2 hours  
**Complexity:** Low  
**Risk:** Low

---

## Success Metrics

**Week 1:**
- ✅ isort #1518 monitoring active
- ✅ Maintainer response detected within 30 min
- ✅ Notification delivered to Telegram
- ✅ Zero missed responses

**Week 2:**
- ✅ 5+ repos monitored
- ✅ New issue detection working
- ✅ Opportunity scoring automated
- ✅ Daily activity summary

**Week 3:**
- ✅ Webhooks operational
- ✅ Real-time notifications (<1 min)
- ✅ Standing orders defined
- ✅ Autonomous monitoring

**Month 1:**
- ✅ 10+ repos tracked
- ✅ Zero manual checking needed
- ✅ Weekly summary reports
- ✅ Cost < $1/month

---

## Next Actions

### Immediate (Today)

1. **Create automation infrastructure:**
   ```bash
   mkdir -p ~/.openclaw/ren-workspace/verdict/automation-state
   ```

2. **Create isort state file:**
   ```bash
   cat > ~/.openclaw/ren-workspace/verdict/automation-state/isort-1518.json << 'EOF'
   {
     "repo": "PyCQA/isort",
     "issue": 1518,
     "lastChecked": "2026-03-30T21:04:47Z",
     "lastCommentId": 4158175958,
     "lastCommentAuthor": "hnshah",
     "status": "waiting-for-maintainer",
     "ourCommentUrl": "https://github.com/PyCQA/isort/issues/1518#issuecomment-4158175958"
   }
   EOF
   ```

3. **Add cron job:**
   ```bash
   openclaw cron add \
     --name "monitor-isort-1518" \
     --every "30m" \
     --session isolated \
     --message "Monitor isort issue #1518 for maintainer response" \
     --model haiku \
     --announce \
     --channel telegram
   ```

4. **Test:**
   ```bash
   openclaw cron list
   openclaw cron run monitor-isort-1518
   ```

---

### Tomorrow

5. **Review automation results**
6. **Tune notification threshold**
7. **Add Exo repo monitoring**
8. **Create multi-repo config**

---

### This Week

9. **Generalize to multiple repos**
10. **Add opportunity scoring**
11. **Set up weekly summary**
12. **Plan webhook integration**

---

## Resources

**OpenClaw Docs:**
- [Cron vs Heartbeat](/automation/cron-vs-heartbeat.md)
- [Cron Jobs](/automation/cron-jobs.md)
- [Webhooks](/automation/webhook.md)
- [Standing Orders](/automation/standing-orders.md)

**GitHub CLI:**
- `gh api` - Make GitHub API calls
- `gh issue list` - List issues
- `gh pr list` - List PRs
- `gh issue view` - View issue details

**State Files:**
- `verdict/automation-state/` - Git-tracked state
- JSON format for easy parsing
- JSONL for append-only logs

---

**Status:** Ready to implement Phase 1 today! 🚀
