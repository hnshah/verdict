# Verdict 24/7 Local Eval Machine — Roadmap

**Goal**: Turn Verdict into a reliable, always-on evaluation system that runs 24/7 against local inference backends (llama.cpp, MLX, Ollama, LM Studio, vLLM, etc.).

**Core Principle**: Verdict stays model-agnostic. We point it at OpenAI-compatible endpoints.

---

## Current State (May 2026)

- Verdict is a strong, actively maintained eval framework
- Uses YAML-based eval packs
- Supports any OpenAI-compatible API
- Has dashboard + regression detection
- Already works with local models via `--base-url`

**Gap**: No built-in scheduling, orchestration, or "set it and forget it" experience.

---

## Vision

A single command experience:

```bash
verdict setup --local          # One-time setup
verdict run --local            # Manual run against local models
# Nightly runs happen automatically via Hermes cron
```

Results, dashboards, and regressions are tracked continuously.

---

## Phased Roadmap

### Phase 0: Foundation (Current)

- [x] GitHub auth helper for Hermes
- [x] Verdict repo cloned and ready
- [ ] Create this roadmap

### Phase 1: Hermes Cron + Basic Runner (Next)

**Goal**: Get Verdict running on a schedule against local endpoints with minimal changes.

**Deliverables**:
- `scripts/verdict-runner.sh` — wrapper that handles local endpoints
- Hermes cron job template (nightly at 2 AM)
- Basic result logging + dashboard regeneration
- Documentation for pointing Verdict at:
  - Ollama (`http://localhost:11434/v1`)
  - llama.cpp server
  - MLX-LM server
  - LM Studio

**Success Criteria**:
- `verdict run --local` works
- Nightly eval runs automatically via Hermes
- Dashboard is regenerated after each run

### Phase 2: Terminal Magic & Polish

- One-command setup: `verdict setup --local`
- Auto-detection of available local backends
- Better result storage structure (`results/`, `dashboards/`)
- Simple Slack/Telegram notifications for regressions
- Improved CLI UX

### Phase 3: Advanced Features

- Multi-model comparison in single run
- Custom eval pack scheduling
- Integration with `localbydefault` for smart routing + fallback
- Webhook support for external triggers
- Historical trend tracking

### Phase 4: Production 24/7

- Robust error handling & retries
- Resource monitoring (GPU/CPU/memory)
- Alerting on repeated failures
- Self-updating dashboard hosted via GitHub Pages or local server

---

## Technical Integration Points

### Hermes Cron

Hermes has excellent cron support (`cronjob` tool + CLI).

Example job we will create:

```yaml
name: verdict-nightly-eval
schedule: "0 2 * * *"
prompt: |
  Run Verdict evaluation against local models.
  Use the verdict-runner script.
  Generate dashboard and commit results.
skills: [verdict]
```

### Local Endpoints

Verdict will continue to use the standard OpenAI-compatible interface:

```bash
verdict run \
  --base-url http://localhost:8080/v1 \
  --model llama-3.1-8b \
  --eval-pack code-review
```

### Repository Structure Additions

```
verdict/
├── scripts/
│   ├── verdict-runner.sh          # Main runner (Phase 1)
│   ├── setup-local.sh             # One-time setup (Phase 2)
│   └── github-auth.sh             # (moved from Hermes)
├── configs/
│   └── local-defaults.yaml
├── results/                       # Generated results
├── dashboards/                    # Auto-generated HTML
└── VERDICT-24-7-ROADMAP.md
```

---

## Next Immediate Steps

1. Create `scripts/verdict-runner.sh`
2. Add first Hermes cron job
3. Test running Verdict against a local endpoint (Ollama or llama.cpp)
4. Iterate on the runner based on real usage

---

## Open Questions

- Preferred default local backend? (Ollama vs llama.cpp server vs MLX)
- How much result history should we keep?
- Notification preferences (Slack, email, GitHub issue, etc.)

---

**Status**: Phase 0 complete. Ready to begin Phase 1.

*Last updated: May 16, 2026*