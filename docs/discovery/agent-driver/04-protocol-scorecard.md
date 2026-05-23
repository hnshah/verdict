# 04 Protocol scorecard: how the agent reaches Verdict

**Status:** not-started
**Phase:** 1d (target: 2 days, highest stakes)

Transport choice is irreversible once any external agent ships against it.

## Homework before recommending

1. Read the MCP spec quickstart end to end; sketch `tools/list` for Verdict:
   `verdict.run`, `verdict.history`, `verdict.diff`, `verdict.digest`, `verdict.subscribe`.
2. Audit how the existing `verdict serve` (OpenAI-compatible HTTP) and `verdict daemon`
   (SQLite job queue) would extend vs duplicate per-transport.
3. Hands-on: Claude Desktop MCP config (30 min); Cline tool-use config (30 min).
4. Identify the *streaming-progress* primitive each surface offers
   (SSE, stdio events, polling). Make-or-break for JTBD-3.
5. Identify the *push/subscribe* primitive each surface offers
   (webhook, SSE, long-poll). Make-or-break for JTBD-2 (scheduled digests).

## Scorecard structure

Rows are surfaces:

- MCP server (new `verdict mcp` subcommand)
- Extend `verdict serve` HTTP with new endpoints
- CLI shell-out with structured JSON output (`verdict run --json`)
- TypeScript library import (consumers import from `@hnshah/verdict`)
- Hybrid (e.g. MCP for pull + daemon webhook for push)

Columns are scoring axes, weighted by load-bearing JTBDs:

| Surface | Streaming progress (JTBD-3) | Push to chat (JTBD-2) | Multi-agent compat | Build cost | Future-proof | Fits scheduled-digest v1 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Hybrid is likely

v1 includes both on-demand pull and scheduled push. A single transport may not
suffice (MCP is pull-only; agents need a way to receive push-style digests).
Sketch how each contender handles BOTH on-demand pull AND scheduled push, and
flag where a hybrid is unavoidable.

## Final cell

Recommendation in 2 lines, plus the no-going-back checkpoint with the user
before Phase 2 closes.
