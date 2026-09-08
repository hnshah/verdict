# 01 Personas: agent-driven Verdict

**Status:** not-started
**Phase:** 1b (target: 0.5 day)
**Anchor:** every persona extends the existing Verdict North Star (indie dev on a MacBook deciding cloud vs local).

## Candidate personas (to flesh out)

- **P1 Indie dev + their primary chat agent.** Primary persona. Direct extension of North Star. The chat agent becomes their eval analyst.
- **P2 Founder/operator shipping LLM features.** Cares more about regression alerts and shareable digests than raw model selection.
- **P3 DevOps-on-a-Mac-mini (lab in a closet).** Extension of North Star to a scheduled-eval lab. Cares about daemon, cron, weekly summaries. Maps to existing `verdict daemon` + new digest emitter.

## Non-goals (explicit)

- Enterprise ML platform team
- Researcher with H100s
- No-code SaaS user

## Format per persona (when filled in)

One page each:

- Goals
- Current workflow (without the feature)
- Hardest moment
- What success looks like
- Which JTBDs they're hiring this feature for

Written for a public audience so this file can graduate to `docs/personas.md`.
