# Compound Engineering Plugin — Analysis & Opportunities

**Repo:** EveryInc/compound-engineering-plugin  
**Stars:** 12,243 ⭐  
**Created:** October 9, 2025  
**Last Push:** March 31, 2026 (TODAY - 07:55 UTC!)  
**Language:** TypeScript  
**Issues:** 10 open  
**Assessed:** 2026-03-31 07:50 PT

---

## TL;DR

**Every's compound engineering plugin is a complete AI-assisted development system.**

- Plan → Work → Review → Compound loop
- 26 specialized agents (14 reviewers!)
- 23 workflow commands
- 13 domain skills
- Supports 10+ AI coding tools (Claude Code, Codex, OpenCode, Copilot, etc.)
- 12K stars, active development

**Key insight:** 80% planning/review, 20% execution. The "compound" step is where gains accumulate.

---

## What It Is

### The Philosophy

**Traditional development:** Each feature adds complexity. Codebase gets harder over time.

**Compound engineering:** Each unit of work makes subsequent work easier.

**How:**
- Plan thoroughly before writing code
- Review to catch issues and capture learnings
- Codify knowledge so it's reusable
- Keep quality high so future changes are easy

**Result:** Bug fixes eliminate entire categories of future bugs. Patterns become tools for future work.

---

## The Main Loop

```
Plan → Work → Review → Compound → Repeat
          ↑
    Ideate (optional brainstorm)
```

**Time allocation:**
- 80% planning + review
- 20% work + compound

### 1. Plan (/ce:plan)
- Understand requirement
- Research codebase
- Research externally (framework docs, best practices)
- Design solution
- Validate plan

**Spawns:**
- repo-research-analyst
- framework-docs-researcher
- best-practices-researcher
- spec-flow-analyzer

**Output:** Structured plan with affected files and implementation steps

### 2. Work (/ce:work)
- Set up isolation (git worktrees)
- Execute plan step-by-step
- Run validations (tests, linting, type checking)
- Track progress
- Handle issues

**Runs in 4 phases:**
1. Quick start (worktree + branch)
2. Execute (implement with progress tracking)
3. Quality check (spawn 5+ reviewer agents)
4. Ship it (linting, create PR)

### 3. Review (/ce:review)
- Multiple agents review in parallel (14 agents!)
- Prioritize findings (P1, P2, P3)
- Resolve findings
- Validate fixes
- Capture patterns

**Spawns 14 specialized reviewers:**
- security-sentinel
- performance-oracle
- data-integrity-guardian
- architecture-strategist
- pattern-recognition-specialist
- code-simplicity-reviewer
- Framework-specific (DHH-rails, Kieran-rails, TypeScript, Python)

### 4. Compound (/ce:compound)
**THIS IS THE MAGIC STEP!**

- Capture the solution (What worked? What didn't?)
- Make it findable (YAML frontmatter, tags, metadata)
- Update the system (add to CLAUDE.md, create new agents)
- Verify the learning (Would system catch this next time?)

**Output:** `docs/solutions/` (categorized, searchable learnings)

---

## What's In The Plugin

### 26 Specialized Agents

**Review (14 agents):**
- security-sentinel
- performance-oracle
- data-integrity-guardian
- architecture-strategist
- pattern-recognition-specialist
- code-simplicity-reviewer
- DHH-rails (Rails patterns)
- Kieran-rails (Every's Rails style)
- TypeScript reviewer
- Python reviewer
- (+ 4 more)

**Research:**
- repo-research-analyst
- framework-docs-researcher
- best-practices-researcher

**Design:**
- UI/UX agents
- Figma sync agents

**Workflow:**
- Automation agents

**Docs:**
- Documentation agents

### 23 Workflow Commands

**Core loop:**
- /ce:ideate (discover improvements)
- /ce:brainstorm (explore requirements)
- /ce:plan (detailed implementation plan)
- /ce:work (execute with tracking)
- /ce:review (multi-agent code review)
- /ce:compound (document learnings)

**Utilities:**
- /deepen-plan (spawn 40+ research agents!)
- /triage (prioritize findings)
- Resolution commands
- (+ more)

### 13 Domain Skills
- Agent-native architecture
- Style guide
- (+ 11 more domain expertise skills)

---

## File Structure

```
your-project/
├── CLAUDE.md              # Agent instructions, preferences, patterns
├── docs/
│   ├── brainstorms/       # /ce:brainstorm output
│   ├── solutions/         # /ce:compound output (SEARCHABLE!)
│   └── plans/             # /ce:plan output
└── todos/                 # Triage and review findings
    ├── 001-ready-p1-fix-auth.md
    └── 002-pending-p2-add-tests.md
```

**CLAUDE.md** is read every session:
- Preferences
- Patterns
- Project context
- Learnings from /ce:compound

**docs/solutions/** builds institutional knowledge:
- Each solved problem becomes searchable
- Future sessions find past solutions automatically
- This is where compounding happens!

---

## Supported AI Coding Tools

**Installation via CLI:**

```bash
# Claude Code (native)
claude /plugin install compound-engineering

# OpenCode
bunx @every-env/compound-plugin install compound-engineering --to opencode

# Codex
bunx @every-env/compound-plugin install compound-engineering --to codex

# OpenClaw
bunx @every-env/compound-plugin install compound-engineering --to openclaw

# All others
bunx @every-env/compound-plugin install compound-engineering --to <target>
```

**Supported targets:**
1. Claude Code (native)
2. OpenCode
3. Codex
4. Factory Droid
5. Pi
6. Gemini CLI
7. GitHub Copilot
8. Kiro CLI
9. OpenClaw ✅ (WE USE THIS!)
10. Windsurf
11. Qwen Code

**Plus:** Sync your personal Claude Code config to all tools!

```bash
# Sync skills + MCP servers to all detected tools
bunx @every-env/compound-plugin sync --target all
```

---

## Technical Implementation

### Conversion System
- TypeScript CLI converts Claude Code plugins
- Maps commands → prompts/workflows/skills per target
- Preserves MCP server configs
- Handles namespace prefixes

### Per-Target Details

| Target | Output Path | Notes |
|--------|-------------|-------|
| opencode | ~/.config/opencode/ | Commands as .md, MCP deep-merged |
| codex | ~/.codex/prompts + skills | Prompt + skill pairs |
| openclaw | ~/.openclaw/extensions/ | Entry-point TypeScript skill |
| copilot | .github/ | Agents as .agent.md |
| windsurf | ~/.codeium/windsurf/ | Skills + flat workflows |
| qwen | ~/.qwen/extensions/ | Agents as .yaml |

### Development Workflow

**Local testing:**
```bash
# Claude Code
alias cce='claude --plugin-dir ~/code/compound-engineering-plugin/plugins/compound-engineering'

# Codex
bun run src/index.ts install ./plugins/compound-engineering --to codex
```

**Branch testing:**
```bash
# Test a branch without switching checkouts
bunx @every-env/compound-plugin install compound-engineering --to codex --branch feat/new-agents
```

---

## Open Issues (Contribution Opportunities!)

### High-Value Issues

**#467 - Use jujutsu, not git worktree** (OPEN, today!)
- /ce:work uses git worktrees
- Request to support jujutsu instead
- Jujutsu is modern VCS with better UX
- **Opportunity:** Add jujutsu support

**#458 - Why was /deepen-plan removed?** (OPEN, today!)
- /deepen-plan spawns 40+ research agents
- User confused about removal
- Actually: still exists, renamed to ultrathink mode
- **Opportunity:** Improve documentation

**#449 - Convert to pi format creates conflicts** (OPEN)
- Conversion CLI has bugs
- Pi format conversion conflicts
- **Opportunity:** Fix conversion logic

**#424 - Selected for awesome-codex-plugins** (OPEN)
- Recognition from Codex community
- Plugin quality validated
- **Opportunity:** Contribute to Codex ecosystem

**#338 - Make docs output path configurable** (OPEN)
- Hardcoded `docs/` path
- Users want custom paths
- **Opportunity:** Add user settings

**#337 - Support namespaced skill aliases** (OPEN)
- `/ce:setup` doesn't work
- Namespace prefixes stripped
- **Opportunity:** Fix aliasing system

**#318 - Usage of MEMORY.md** (OPEN)
- MEMORY.md for capturing details
- Integration with compound system
- **Opportunity:** MEMORY.md pattern integration

**#314 - Skill "name" field ignored** (OPEN, active today!)
- /ce:brainstorm doesn't work
- Requires full `/compound-engineering:ce-brainstorm`
- Skill name field ignored
- **Opportunity:** Fix skill name resolution

---

## Opportunities for Us

### 1. Install & Use in OpenClaw ✅ HIGH VALUE

**Why:**
- We use OpenClaw!
- Plugin has native OpenClaw support
- 26 agents + 23 commands ready to use
- Compound loop matches our workflow

**How:**
```bash
bunx @every-env/compound-plugin install compound-engineering --to openclaw
```

**What we get:**
- /ce:plan → structured planning
- /ce:review → 14 parallel reviewers!
- /ce:compound → learnings accumulate
- Integration with our workflow

**Content opportunity:**
- "Using Compound Engineering with OpenClaw"
- Workflow comparison
- Results from using /ce:review on our PRs

### 2. Contribute Bug Fixes 🟡 MEDIUM VALUE

**Why:**
- 10 open issues
- Active repo (pushed today!)
- Good first issues available
- 12K stars = high visibility

**What to fix:**
- #314 - Skill name field ignored (ACTIVE TODAY!)
- #338 - Configurable docs output path
- #449 - Pi format conversion conflicts

**Content opportunity:**
- OSS contribution story
- Every's plugin ecosystem
- TypeScript CLI tooling

### 3. Test OpenClaw Integration ✅ HIGH VALUE

**Why:**
- OpenClaw support is experimental
- Plugin pushed today (fresh!)
- We can be first to test thoroughly
- Report issues = contribution

**What to test:**
- Installation process
- Command availability
- Agent spawning
- MCP server integration
- Skill syncing

**Content opportunity:**
- "OpenClaw + Compound Engineering: First Test"
- Integration quality
- Comparison to Claude Code

### 4. Create verdict Eval Pack for Review Quality 🟡 MEDIUM VALUE

**Why:**
- /ce:review spawns 14 agents
- We have verdict eval infrastructure
- Can benchmark review quality
- Test multi-agent review approach

**What to eval:**
- Security findings (vs manual review)
- Performance findings
- Architecture suggestions
- Code simplicity improvements

**Content opportunity:**
- "Benchmarking AI Code Review: 14 Agents vs Manual"
- verdict eval pack for code review
- Quality comparison

### 5. Integrate with Our Workflow ✅ HIGH VALUE

**Why:**
- We contribute to OSS daily
- /ce:plan + /ce:review would help
- /ce:compound captures learnings
- Fits our contribution loop

**How to use:**
1. /ce:plan → detailed PR plan
2. /ce:work → implementation
3. /ce:review → catch issues before submission
4. /ce:compound → document patterns

**Content opportunity:**
- "30 Days of Compound Engineering: Did It Work?"
- Workflow evolution
- Quality improvements
- Time savings

---

## Comparison to Our Current Workflow

### What We Do Now

**Discovery:**
- Manual repo analysis
- Issue filtering by hand
- Opportunity scoring

**Implementation:**
- Write code
- Test locally
- Submit PR

**Review:**
- Wait for maintainer
- Respond to feedback

**Learning:**
- Ad-hoc documentation
- No systematic capture

### What Compound Engineering Adds

**Discovery:**
- /ce:ideate (proactive improvement discovery!)
- Automated opportunity scoring
- Codebase archaeology

**Planning:**
- /ce:brainstorm (requirement exploration)
- /ce:plan (3 parallel research agents)
- /deepen-plan (40+ agents!)

**Implementation:**
- /ce:work (git worktrees, progress tracking)
- Automated quality checks
- Test-driven by default

**Review:**
- /ce:review (14 parallel agents!)
- Prioritized findings (P1/P2/P3)
- Multiple specialties

**Learning:**
- /ce:compound (systematic capture!)
- docs/solutions/ (searchable)
- CLAUDE.md updates
- Future sessions learn automatically

**The Gap:**
We have steps 1-3. We're missing step 4 (compound). That's where gains accumulate!

---

## Risks & Considerations

### 1. Complexity Overhead

**Risk:** 26 agents + 23 commands = steep learning curve  
**Mitigation:** Start with core loop only (/ce:plan, /ce:work, /ce:review, /ce:compound)

### 2. OpenClaw Integration Experimental

**Risk:** "Experimental" support might be buggy  
**Mitigation:** Test thoroughly, report issues, contribute fixes

### 3. Every's Internal Tooling

**Risk:** Plugin optimized for Every's workflow (Rails, TypeScript)  
**Mitigation:** Still valuable patterns, adaptable to our stack

### 4. Time Investment

**Risk:** Learning system takes time upfront  
**Mitigation:** Payoff is compounding - each cycle gets faster

---

## Recommendation

### Immediate (This Week)

✅ **Install in OpenClaw**
```bash
bunx @every-env/compound-plugin install compound-engineering --to openclaw
```

✅ **Test core loop**
- Run /ce:plan on simple feature
- Run /ce:work on implementation
- Run /ce:review on result
- Run /ce:compound to capture learning

✅ **Document experience**
- Installation process
- Command availability
- Integration quality
- Issues encountered

### This Month

✅ **Use on real OSS contribution**
- Pick next isort or remindctl task
- Run full compound loop
- Compare to manual workflow
- Measure quality + time

🟡 **Contribute bug fix**
- #314 (skill name field) or #338 (configurable paths)
- Small, well-defined issues
- TypeScript CLI work

✅ **Create verdict eval pack**
- Code review quality benchmarks
- Test /ce:review output
- Compare to manual review

### Later

🟡 **Write integration guide**
- "OpenClaw + Compound Engineering"
- Installation, usage, patterns
- Contribute to plugin docs

🟡 **Propose OpenClaw improvements**
- Based on testing experience
- Integration pain points
- Feature requests

---

## Content Angles

### Installation & Setup
"Installing Compound Engineering in OpenClaw: First Impressions"
- Step-by-step setup
- Command availability
- Integration quality

### Workflow Comparison
"30 Days of Compound Engineering: OSS Contribution Results"
- Before/after workflow
- Quality improvements
- Time savings
- Learnings captured

### Technical Deep-Dive
"How Compound Engineering's /ce:review Works: 14 Parallel Agents"
- Agent architecture
- Review coordination
- Priority ranking
- Quality benchmarks

### OSS Contribution
"Contributing to Every's Compound Engineering Plugin"
- Bug fix story
- TypeScript CLI tooling
- Plugin ecosystem

---

## Key Insights

### 1. The Compound Step Is The Magic

Traditional AI coding:
- Plan → Work → Review → **DONE**

Compound engineering:
- Plan → Work → Review → **Compound** → Repeat
- Step 4 is where gains accumulate!

### 2. Multi-Agent Review Is Powerful

**14 parallel reviewers:**
- security-sentinel
- performance-oracle
- architecture-strategist
- (+ 11 more)

**Each sees different issues:**
- Security vulnerabilities
- Performance bottlenecks
- Architecture problems
- Code simplicity

**Combined output:**
- Single prioritized list
- P1/P2/P3 classification
- No duplicate findings

### 3. Institutional Knowledge Compounds

**docs/solutions/ is searchable:**
- Each problem solved once
- Future sessions find past solutions
- Patterns become reusable
- Codebase gets easier over time

**This is the core insight!**

### 4. 80/20 Rule

**80% planning + review:**
- More thinking before code
- Catch issues early
- Better designs

**20% work + compound:**
- Less coding time
- More learning capture

**Result:** Higher quality, less rework

---

## Timeline & Next Steps

**Released:** October 2025  
**Last Push:** March 31, 2026 (today!)  
**Assessed:** March 31, 2026

**Next actions:**
1. Install in OpenClaw (today)
2. Test core loop (this week)
3. Use on real contribution (this week)
4. Write setup guide (next week)

---

## Links & Resources

**Repo:** https://github.com/EveryInc/compound-engineering-plugin  
**Guide:** https://every.to/guides/compound-engineering  
**Essay:** https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents  
**Story:** https://every.to/source-code/my-ai-had-already-fixed-the-code-before-i-saw-it

**Issues:**
- #467 - jujutsu support
- #458 - /deepen-plan docs
- #449 - Pi conversion
- #314 - skill name field (ACTIVE!)
- #338 - configurable paths
- #337 - namespaced aliases

---

## Status

**Assessment:** EXCELLENT opportunity  
**Priority:** HIGH (install and test immediately)  
**Content value:** HIGH (workflow transformation, quality improvements)  
**Risk:** LOW (active project, 12K stars, OpenClaw support exists)

**Next action:** Install in OpenClaw and test core loop!

---

**Updated:** 2026-03-31 07:55 PT  
**Analyst:** Ren
