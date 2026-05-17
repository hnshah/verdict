---
name: verdict
description: Verdict LLM Evaluation Framework integration for Hermes
version: 0.1.0
author: Hermes + Verdict Team
---

# Verdict Skill

This skill provides seamless integration between **Hermes Agent** and the **Verdict** evaluation framework.

## Capabilities

- Run evaluations against local or remote models
- Schedule recurring evaluations via Hermes cron
- Generate and manage dashboards
- Support for all OpenAI-compatible endpoints (Ollama, llama.cpp, MLX, LM Studio, etc.)

## Slash Commands

- `/verdict run` — Run an evaluation
- `/verdict status` — Show recent runs and results
- `/verdict dashboard` — Regenerate dashboard

## Usage Examples

### Run a local evaluation
```bash
/verdict run --local --pack code-review
```

### Run against specific endpoint
```bash
/verdict run --endpoint http://localhost:8080/v1 --model llama-3.1
```

## Cron Integration

The skill works excellently with Hermes cron jobs:

```yaml
skills: [verdict]
prompt: Run Verdict evaluation using the local runner
```

## Configuration

Default local endpoint: `http://localhost:11434/v1` (Ollama)

Override via environment variables or command flags.

## Roadmap

- [ ] Full slash command support
- [ ] Automatic backend detection
- [ ] Regression alerting
- [ ] Multi-model comparison mode
- [ ] Integration with localbydefault