# 02 Jobs-To-Be-Done: agent-driven Verdict

**Status:** not-started
**Phase:** 1a (target: 1 day)
**Convention:** stable `JTBD-N` IDs. PRs cite these by anchor link.

## Candidate JTBDs (to validate)

### JTBD-1 (load-bearing): chat-native eval triggering

> When I'm in my coding chat, I want to ask my agent to run or manage Verdict evals
> so I don't have to context-switch out to a CLI.

If false, the whole feature is solving the wrong problem.

### JTBD-2 (load-bearing): proactive insights

> When something interesting happens (regression, new winner, anomaly), I want my
> agent to surface it proactively (hourly, daily, weekly) without me having to ask.

This is the *insights* half. Differentiates the feature from a plain CLI wrapper.

### JTBD-3: streamed progress in chat

> When my evals are running long, I want progress streamed into chat so I don't
> babysit a terminal.

### JTBD-4: autonomous model-frontier maintenance

> When a new model drops, I want my agent to autonomously add it to my eval suite
> and report how it stacks up against my current frontier.

### JTBD-5: shareable narrative digests

> I want a model-comparison narrative I can paste into Slack, a PR, or a README
> without writing it myself.

Bridges to existing `verdict share` (PR #136).

## Validation method

Self-walkthrough. For each candidate:

1. State the JTBD in one paragraph.
2. Describe the current workaround (without this feature, using today's Verdict CLI).
3. Mark verdict: **kept** / **merged** / **dropped**.
4. Capture supporting evidence (existing user notes, ROADMAP excerpts, FAQ entries).

A JTBD only survives if the workaround is painful or impossible today.

## Graduation

Once stable, this file should be promoted to `docs/jtbds.md` at repo root and
feed the broader Verdict strategy, not just this epic.
