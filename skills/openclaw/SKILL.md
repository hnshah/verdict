# verdict skill for OpenClaw

Run LLM evals from chat. Ask your agent to benchmark models, run a pack, or check which local model to use for a task.

## Setup

1. Install verdict: `npm install -g verdict`
2. Create config: `verdict init` in your project directory
3. Add this skill to your OpenClaw workspace

## Usage

Ask your agent:

- "Run verdict evals"
- "Benchmark my local models"
- "Which model is best for coding tasks?"
- "Discover what Ollama models I have"
- "Run the MoE benchmark pack"

## What the agent does

1. Checks verdict.yaml exists (offers to create if not)
2. Runs `verdict models discover` to show available models
3. Runs `verdict run` with appropriate flags
4. Reports the leaderboard and cost-quality recommendation

## Agent instructions

When asked to run evals or benchmark models:

```bash
# Check config exists
ls verdict.yaml || verdict init

# Discover local models
verdict models discover

# Run evals
verdict run

# For MoE comparison
verdict run --pack ./eval-packs/moe.yaml

# For a specific model subset
verdict run --models local-fast,cloud-mini
```

Parse the terminal output for the winner and cost-quality frontier finding.
Report back: which model won, by how much, and whether a free local model is competitive.

## Config

verdict.yaml lives in the project directory. Edit it to add/remove models.
Env vars: OLLAMA_HOST, MLX_PORT, OPENROUTER_API_KEY, OPENAI_API_KEY.
