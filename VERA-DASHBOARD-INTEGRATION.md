# Vera's Dashboard Integration Plan

**From:** Vera  
**To:** Ren  
**Date:** 2026-03-29  
**Status:** Ready to integrate

---

## What Vera Built

**Universal dashboard generator for Verdict eval results.**

**Live demo:** https://vera-verdict.pages.dev

**Features:**
- Multi-category scorecards (Arena.ai style)
- Head-to-head model comparison
- Deep test case details (prompts, responses, reasoning)
- Timeline charts
- Mobile responsive

**Tech:**
- Zero dependencies (vanilla JS + Tailwind CDN)
- No build step (works in browser)
- Static (no backend)
- Fast (<1s load, <100KB total)
- Self-contained (single HTML + JSON)

---

## Integration Steps

### 1. Add CLI Command ✅

**Command:**
```bash
verdict dashboard generate --output dashboard-data.json
```

**What it does:**
- Aggregates all results from `results/`
- Creates standardized JSON
- Outputs `dashboard-data.json`

**Data format:**
```json
{
  "meta": {
    "total_runs": 14,
    "total_cases": 33,
    "last_updated": "2026-03-29"
  },
  "models": {
    "model-id": {
      "name": "...",
      "scores": { ... },
      "metadata": { ... }
    }
  },
  "cases": [
    {
      "id": "...",
      "runs": [ ... ],
      "responses": { ... },
      "scores": { ... }
    }
  ]
}
```

**Implementation:**
```typescript
// src/cli/commands/dashboard.ts
export async function generateDashboard(options: DashboardOptions) {
  const results = await loadResults(options.resultsDir);
  const dashboardData = aggregateResults(results);
  await writeFile(options.output, JSON.stringify(dashboardData, null, 2));
  console.log(`✅ Dashboard data written to ${options.output}`);
}
```

---

### 2. Bundle Dashboard Template ✅

**Add to Verdict repo:**
```
verdict/
├── templates/
│   └── dashboard/
│       ├── index.html      # Dashboard (16KB)
│       ├── validate.html   # QA tool (9KB)
│       └── README.md
```

**Deploy command:**
```bash
verdict dashboard deploy
```

**What it does:**
- Copies `templates/dashboard/` to output dir
- Copies `dashboard-data.json`
- Ready to deploy to Cloudflare Pages / Netlify / Vercel

---

### 3. Data Format (Already Compatible!) ✅

**Verdict already has:**
- `responses` — Model outputs
- `scores` — Judge evaluations
- `runs` — Historical data

**Dashboard expects:** Same structure!

**No conversion needed.** ✅

---

### 4. QA Validation Built-In ✅

**validate.html checks:**
- Required fields present
- Scores in 0-10 range
- Valid JSON structure
- Missing data warnings

**Usage:**
```bash
verdict dashboard validate dashboard-data.json
```

---

### 5. Community Submission System ✅

**GitHub repo with:**
- Issue templates for submissions
- Automated validation (GitHub Actions)
- Merge workflow

**Becomes:** "Unofficial Verdict leaderboard" — community-owned, transparent

---

## Benefits

**For Verdict:**
- ✅ Every user can share results
- ✅ Transparent benchmarking
- ✅ Community leaderboard
- ✅ No vendor lock-in
- ✅ Drives adoption

**For Users:**
- ✅ Beautiful dashboards (vs plain JSON)
- ✅ Shareable links
- ✅ Professional presentation
- ✅ Zero setup (static files)

**For Community:**
- ✅ Central place for benchmarks
- ✅ Compare across users
- ✅ Reproducible results
- ✅ Transparent methodology

---

## Proposed Verdict Repo Structure

```
verdict/
├── src/
│   └── cli/
│       └── commands/
│           └── dashboard.ts          # NEW - CLI command
├── templates/
│   └── dashboard/                    # NEW - Dashboard template
│       ├── index.html                # Main dashboard (16KB)
│       ├── validate.html             # QA tool (9KB)
│       └── README.md                 # Usage docs
├── docs/
│   └── dashboard.md                  # NEW - Integration guide
├── README.md                         # Add dashboard section
└── package.json                      # Add dashboard scripts
```

---

## CLI Commands to Add

### Generate
```bash
verdict dashboard generate [options]

Options:
  --output, -o <path>     Output file (default: dashboard-data.json)
  --results-dir <path>    Results directory (default: ./results)
  --include-private       Include private results (default: false)
```

**Example:**
```bash
verdict dashboard generate --output public/dashboard-data.json
```

---

### Deploy
```bash
verdict dashboard deploy [options]

Options:
  --output-dir <path>     Output directory (default: ./dashboard)
  --platform <name>       Platform (cloudflare|netlify|vercel)
  --open                  Open in browser after deploy
```

**Example:**
```bash
verdict dashboard deploy --platform cloudflare --open
```

**What it does:**
1. Generates `dashboard-data.json`
2. Copies dashboard template files
3. Optionally deploys to platform
4. Opens in browser

---

### Validate
```bash
verdict dashboard validate <file>

Options:
  --strict                Exit with error on warnings
  --fix                   Auto-fix common issues
```

**Example:**
```bash
verdict dashboard validate dashboard-data.json --strict
```

---

## Implementation Priority

### Phase 1: Core Integration (Week 1)

**Must-have:**
1. ✅ Get dashboard files from Vera
2. ✅ Add `dashboard.ts` command
3. ✅ Add `templates/dashboard/` folder
4. ✅ Implement `dashboard generate`
5. ✅ Test with existing results
6. ✅ Document in README

**Deliverable:** Users can generate dashboard locally

---

### Phase 2: Deployment (Week 2)

**Should-have:**
1. ✅ Implement `dashboard deploy`
2. ✅ Add platform integrations (Cloudflare/Netlify/Vercel)
3. ✅ Add validation command
4. ✅ Write `docs/dashboard.md`
5. ✅ Add examples to repo

**Deliverable:** Users can deploy dashboards with one command

---

### Phase 3: Community (Week 3)

**Nice-to-have:**
1. ✅ Set up community repo
2. ✅ Create submission templates
3. ✅ Add GitHub Actions validation
4. ✅ Launch community leaderboard
5. ✅ Document contribution process

**Deliverable:** Community-owned benchmark repository

---

## Questions for Vera

**Before we integrate, need to know:**

1. **Where are the dashboard files?**
   - Mentioned: `~/.openclaw/workspace/vera-space/verdict-dashboard/`
   - Can we get the actual files? (index.html, validate.html)

2. **Data format specifics:**
   - Exact JSON schema expected?
   - Any fields we need to add to Verdict results?
   - Compatibility with existing results?

3. **Deployment preferences:**
   - Which platform to prioritize? (Cloudflare/Netlify/Vercel)
   - GitHub Pages support?
   - Custom domain setup?

4. **Community repo:**
   - Create new repo or use existing?
   - Ownership/maintenance plan?
   - Moderation strategy?

5. **Branding:**
   - "Verdict Dashboard" vs "Vera Dashboard"?
   - Attribution/credits?
   - License?

---

## Next Actions

**Option A: Full Integration (Recommended)**
1. Get dashboard files from Vera
2. Create PR to hnshah/verdict with:
   - `src/cli/commands/dashboard.ts`
   - `templates/dashboard/` folder
   - `docs/dashboard.md`
   - README update
3. Test with our CLI results
4. Merge and release

**Option B: Separate Repo First**
1. Create `verdict-dashboard` repo
2. Publish standalone tool
3. Later: Integrate into Verdict CLI
4. Keep repos in sync

**Option C: Hybrid**
1. Dashboard lives in separate repo (maintained by Vera)
2. Verdict CLI just calls it (npm install verdict-dashboard)
3. Loose coupling, separate versioning

---

## Recommendation: Option A (Full Integration)

**Why:**
- ✅ Better UX (single tool)
- ✅ Tighter integration
- ✅ Drives Verdict adoption
- ✅ Community sees value immediately
- ✅ We control roadmap together

**Concerns:**
- Adds maintenance burden to Verdict
- Need clear ownership (who maintains dashboard code?)

**Mitigation:**
- Vera owns `templates/dashboard/` folder
- We own CLI integration
- Clear CODEOWNERS file

---

## Technical Compatibility Check

**Verdict's current result format:**
```json
{
  "run_id": "...",
  "timestamp": "...",
  "models": [ ... ],
  "cases": [ ... ],
  "summary": { ... },
  "environment": { ... }
}
```

**Dashboard expects:**
```json
{
  "meta": { ... },
  "models": { ... },
  "cases": [ ... ]
}
```

**Conversion needed?**
- Aggregate multiple runs → single dashboard data
- Flatten structure
- Calculate totals

**Implementation:**
```typescript
function aggregateResults(runs: VerdictResult[]): DashboardData {
  return {
    meta: {
      total_runs: runs.length,
      total_cases: countUniqueCases(runs),
      last_updated: new Date().toISOString()
    },
    models: aggregateModelStats(runs),
    cases: aggregateCaseStats(runs)
  };
}
```

---

## Measuring Success

**Metrics to track:**

**Adoption:**
- # of users running `verdict dashboard generate`
- # of deployed dashboards
- # of community submissions

**Engagement:**
- # of dashboard views
- # of shared links
- # of GitHub stars on community repo

**Quality:**
- User feedback
- Bug reports
- Feature requests

**Target (3 months):**
- 50+ deployed dashboards
- 10+ community submissions
- 100+ GitHub stars

---

## Documentation Needed

**1. docs/dashboard.md**
- How to generate dashboard
- How to deploy
- How to validate
- How to customize
- How to submit to community

**2. README section**
- Dashboard overview
- Quick start
- Link to live examples

**3. templates/dashboard/README.md**
- Template usage
- Customization options
- Technical details

**4. Community repo docs**
- Submission guidelines
- Validation requirements
- Merge process

---

## Timeline

**Week 1: Integration**
- Get files from Vera
- Implement CLI commands
- Test locally
- PR ready

**Week 2: Documentation**
- Write docs
- Create examples
- Test with users

**Week 3: Community**
- Set up repo
- Launch leaderboard
- Announce publicly

**Week 4: Polish**
- Fix bugs
- Add features
- Gather feedback

---

## Risk Assessment

**Low Risk:**
- ✅ Static files (no backend)
- ✅ No dependencies
- ✅ Backward compatible

**Medium Risk:**
- ⚠️ Data format changes (need versioning)
- ⚠️ Community moderation (need guidelines)

**High Risk:**
- ❌ Maintenance burden (need clear ownership)
- ❌ Scope creep (need clear boundaries)

**Mitigation:**
- Clear ownership model
- Semantic versioning
- Modular design
- Community guidelines

---

## Status: Ready to Proceed ✅

**We have:**
- ✅ Live demo (https://vera-verdict.pages.dev)
- ✅ Clear integration plan
- ✅ Compatible data format
- ✅ Community strategy

**We need:**
1. Dashboard files from Vera
2. Confirmation on integration approach
3. Go-ahead to create PR

**Recommendation:**

**Ask Vera for:**
1. Dashboard source files (index.html, validate.html)
2. Exact data schema
3. Preferred integration approach (A/B/C)
4. Timeline/availability for collaboration

**Then:**
- Create integration branch
- Implement CLI commands
- Test thoroughly
- Submit PR to hnshah/verdict

---

**This is excellent work from Vera. Let's integrate it properly!** 🚀

**Ready when you are, Hiten.**
