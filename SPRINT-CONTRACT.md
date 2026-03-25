# Sprint Contract: verdict autonomous eval harness

**Question this sprint answers:** Can verdict run unattended, survive long runs, catch regressions, and deliver plain-English recommendations without human involvement?

**Date:** 2026-03-25
**Branch:** feature/autonomous-harness

---

## What will be built

### 1. Checkpoint / resume on `verdict run`
- Runner saves progress to `.verdict-checkpoint.json` in the results dir after each case completes
- On restart with `--resume`, runner reads checkpoint, skips already-completed cases, continues from last saved state
- Checkpoint stores: run config hash, completed case IDs, partial scores, run start time
- On clean completion, checkpoint is deleted automatically
- Flag: `verdict run --resume` (auto-finds latest checkpoint for this config)

### 2. Eval question + synthesis agent
- New flag: `verdict run --question "Is model X worth Y cost for Z tasks?"`
- After all scores are computed, a synthesis agent (uses the judge model) is called with:
  - The original question
  - The full leaderboard + per-case scores
  - Baseline delta (if baseline exists)
- Synthesis agent outputs a structured recommendation:
  ```
  Verdict: [CLEAR / LEAN / INCONCLUSIVE]
  Recommendation: [1-2 sentence plain-English answer to the question]
  Confidence: [HIGH / MEDIUM / LOW]
  Key finding: [single most important data point]
  Caveats: [what this run can't tell you]
  ```
- Recommendation is included in both JSON and Markdown outputs

### 3. Baseline persistence
- New command: `verdict baseline save <name>` — saves the most recent result JSON as a named baseline in `.verdict-baselines/`
- New command: `verdict baseline list` — shows saved baselines with date and model count
- New command: `verdict baseline compare <name>` — compares most recent run against named baseline
- Baseline comparison output:
  - Per-model score delta (↑↓ with percentage)
  - Regression alert if any model drops > 0.5pts
  - New models / removed models noted
- Auto-compare: if a baseline named `default` exists, `verdict run` automatically runs baseline comparison at end

### 4. OpenClaw scheduled integration
- New file: `verdict-schedule.yaml` — example config for scheduled runs with Slack reporting
- New output format: `slack` — posts a compact result card to Slack webhook/channel
  - Winner + score
  - Synthesis recommendation (if --question provided)
  - Regression alert if baseline degraded
  - Link to full markdown report
- New file: `skills/verdict-autonomous/SKILL.md` — OpenClaw skill for:
  - Running verdict on demand from Slack (`/verdict run`)
  - Setting up a weekly cron
  - Reading results and posting summaries

---

## What will NOT be built

- No UI / web dashboard
- No database — baselines are flat JSON files
- No multi-judge consensus (single judge model, same as today)
- No automatic model discovery as part of scheduled runs (that's a separate concern)
- No changes to existing eval pack format

---

## Acceptance criteria

| # | Criterion | Verified by |
|---|-----------|-------------|
| 1 | `verdict run` with 10+ cases creates a `.verdict-checkpoint.json` after each case | Check file exists mid-run |
| 2 | Interrupting a run and running `verdict run --resume` skips completed cases | Manual test: kill mid-run, resume, check logs show "skipping case X" |
| 3 | `verdict run --question "..."` produces a synthesis block in markdown output | Read output markdown, check Verdict/Recommendation/Confidence fields present |
| 4 | Synthesis uses judge model (not hardcoded model) | Read synthesis call in code |
| 5 | `verdict baseline save mybaseline` creates `.verdict-baselines/mybaseline.json` | Check file |
| 6 | `verdict baseline compare mybaseline` shows per-model score delta | Run compare, check output format |
| 7 | `verdict run` with a `default` baseline auto-runs comparison at end | Check output includes baseline comparison section |
| 8 | Regression alert fires when a model drops > 0.5pts vs baseline | Test with manipulated baseline JSON |
| 9 | `output.formats: [slack]` in config posts a compact card format (not full markdown) | Check slack output shape |
| 10 | `skills/verdict-autonomous/SKILL.md` exists with working cron template | Read file |
| 11 | All existing tests pass (`npm run typecheck`) | CI |
| 12 | `verdict run` without any new flags works identically to today | Regression test |

---

## Definition of done

All 12 acceptance criteria pass. `npm run typecheck` clean. Changes committed to `feature/autonomous-harness`. No breaking changes to existing commands or config format.
