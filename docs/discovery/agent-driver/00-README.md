# Discovery: External agents drive Verdict over chat (`AD`)

**Phase code:** `AD`
**Status:** Phase 0 (scaffolding)
**Epic:** #TBD (will be replaced once the epic issue is opened)
**Last updated:** 2026-05-22

## What this folder is

Forward-looking discovery for the **agent-driver** epic: letting an external AI
agent (OpenClaw, Hermes Agent, Claude Desktop, Cline, etc.) drive Verdict
end-to-end over chat. Discovery is forward; retrospectives live in
[`docs/research/`](../../research/).

Each file has a `Status:` header. PRs cite stable IDs from these files (e.g.
`JTBD-3`, `RFC-1`) so the audit trail survives renames and reorgs.

## How to read this folder

1. Start here.
2. **Personas** ([01](./01-personas.md)) describe who has the problem.
3. **JTBDs** ([02](./02-jtbds.md)) describe what they're trying to do.
4. **Prior art** ([03](./03-prior-art.md)) describes who has tried this before and what they learned.
5. **Protocol scorecard** ([04](./04-protocol-scorecard.md)) chooses how the agent reaches Verdict.
6. **Synthesis** ([00-synthesis.md](./00-synthesis.md), added after Phase 1) rolls the above into a coherent recommendation.
7. **Decisions log** ([05](./05-decisions-log.md)) records every accepted-or-rejected call as RFCs close.

## Workflow status

| File | Status | Owner |
| --- | --- | --- |
| 01-personas.md | not-started | @hnshah |
| 02-jtbds.md | not-started | @hnshah |
| 03-prior-art.md | not-started | @hnshah |
| 04-protocol-scorecard.md | not-started | @hnshah |
| 00-synthesis.md | not-started (added end of Phase 1) | @hnshah |
| 05-decisions-log.md | not-started (populated as RFCs close) | @hnshah |

## Locked-in framing (from the planning conversation)

1. Transport is **genuinely open**. Phase 1 scores MCP vs HTTP vs CLI vs library.
2. v1 ships **both on-demand chat-driven AND scheduled digests**.
3. Discovery rigor: standard, no external interviews.
4. PR titles for epic work use `feat(agent): AD<n> ...`.

## Out of scope (for this epic)

- Cloud-hosted Verdict
- Multi-tenant agent auth
- Verdict-as-the-agent (this is about Verdict being driven, not driving)
