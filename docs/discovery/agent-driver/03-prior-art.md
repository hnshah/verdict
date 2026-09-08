# 03 Prior art: agent-driven Verdict

**Status:** not-started
**Phase:** 1c (target: 1.5 days)

## Surfaces to inspect (with the lesson to extract)

### Eval tools with programmatic surfaces

- **promptfoo**: CI integration patterns, `promptfoo eval --output`. What's the agent-callable surface? How does it stream progress?
- **Braintrust**: programmatic API plus dashboards. How are insights exposed?
- **LangSmith**: trace-driven insights. What does a "narrative" look like?
- **lm-eval-harness**: CLI ergonomics. Closest peer; what's missing for an agent driver?
- **Helicone, Honeycomb BubbleUp, Datadog Watchdog**: anomaly-explanation primitives. State of the art for "insights".

### Agent integration patterns

- **MCP server catalog (modelcontextprotocol.io/servers)**: which servers ship insight-style tools vs raw RPC?
- **Claude Desktop MCP config**: 30 min hands-on. How is the friction?
- **Cline / Aider tool-use**: what convention do agents expect from a CLI tool?
- **ChatGPT plugins (deprecated)**: failure modes; why didn't this take off?

### Scheduled-digest prior art (critical for v1 scope)

- LangSmith run analytics digests
- GitHub weekly digest emails (good UX baseline)
- Datadog Watchdog narrative alerts
- Honeycomb BubbleUp "anomaly + example" pattern

## Questions the scan must answer

1. What's the lowest-friction transport for an external agent today?
2. How do these tools represent *progress* in chat (token-by-token, polling, webhooks)?
3. What does "good" automated insight look like (narrative, bullets, structured deltas + one example)?
4. Who has failed at scheduled digests, and why? Spam fatigue is the predictable killer; an explicit answer is required.

## Output format

A table:

| Tool | Surface | Progress representation | Insight format | Lesson for us |
| --- | --- | --- | --- | --- |
| ... | ... | ... | ... | ... |

Followed by a one-paragraph synthesis: "based on prior art, the load-bearing
choice for Verdict is X because Y."
