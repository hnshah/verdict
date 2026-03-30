# Automation State Directory

**Purpose:** Track state for all GitHub monitoring automation

---

## Active Monitoring

### 1. isort Issue #1518
**File:** `isort-1518.json`  
**Cron:** `monitor-isort-1518` (every 10 min)  
**Purpose:** Track maintainer response on our contribution

### 2. Exo Repository
**File:** `exo-repo.json`  
**Cron:** `monitor-exo-repo` (every 10 min)  
**Purpose:** Track all issues/PRs for contribution opportunities

### 3. Our PRs (All Repos)
**File:** `our-prs.json`  
**Cron:** `monitor-our-prs` (every 10 min)  
**Purpose:** Track all our open PRs across GitHub

---

## Cron Jobs

### High-Frequency (Every 10 min)
1. **monitor-isort-1518** - Check for maintainer response
2. **monitor-exo-repo** - Check for new issues/PRs
3. **monitor-our-prs** - Check all our PRs for updates

### Medium-Frequency (Every 2 hours)
4. **scan-new-opportunities** - Find new contribution opportunities

### Daily (8 AM PT, Weekdays)
5. **daily-oss-briefing** - Morning summary of overnight activity

### Weekly (Monday 9 AM PT)
6. **weekly-oss-summary** - Comprehensive weekly report

---

## State File Format

### isort-1518.json
```json
{
  "repo": "PyCQA/isort",
  "issue": 1518,
  "lastChecked": "ISO timestamp",
  "lastCommentId": 123456,
  "lastCommentAuthor": "username",
  "status": "waiting-for-maintainer",
  "ourCommentUrl": "https://..."
}
```

### exo-repo.json
```json
{
  "repo": "ankitvgupta/mail-app",
  "tracking": {
    "allIssues": true,
    "allPRs": true
  },
  "lastChecked": "ISO timestamp",
  "lastIssueNumber": 10,
  "lastPRNumber": 0,
  "status": "monitoring"
}
```

### our-prs.json
```json
{
  "author": "hnshah",
  "lastChecked": "ISO timestamp",
  "trackedPRs": [
    {
      "repo": "owner/repo",
      "number": 123,
      "title": "...",
      "status": "open",
      "lastUpdate": "ISO timestamp"
    }
  ]
}
```

---

## Notification Priorities

### IMMEDIATE (Telegram alert)
- Maintainer response on our issue/PR
- PR approved
- Changes requested
- High-value new opportunity (score ≥15)

### DAILY (Morning briefing)
- New issues in tracked repos
- PR updates (non-critical)
- Good opportunities (score 8-14)

### WEEKLY (Monday summary)
- Overall activity
- All tracked repos
- Opportunity recommendations

---

## Cost Estimates

### Per Day
- 10-min jobs (3): 144 runs × 3 = 432 runs/day
- 2-hour job (1): 12 runs/day
- Daily job (1): 1 run/day
- **Total:** ~445 runs/day

### Per Month
- ~13,350 agent turns
- Average ~1000 tokens per run (Haiku)
- Cost: **~$1.34/month**

**Weekly report (Sonnet):** ~$0.10/week = $0.40/month

**Total:** **~$1.74/month** for full automation!

---

## Manual Commands

### List all jobs
```bash
openclaw cron list
```

### Run job manually
```bash
openclaw cron run <job-id>
```

### Check run history
```bash
openclaw cron runs --id <job-id>
```

### Edit job
```bash
openclaw cron edit <job-id> --every "15m"
```

### Disable job
```bash
openclaw cron disable <job-id>
```

---

## Maintenance

### Add New Repo
1. Create state file (e.g., `new-repo.json`)
2. Add cron job with `openclaw cron add`
3. Update this README
4. Commit state file to git

### Remove Repo
1. Disable cron job: `openclaw cron disable <id>`
2. Delete state file
3. Update README

---

**Status:** All automation ACTIVE as of 2026-03-30
