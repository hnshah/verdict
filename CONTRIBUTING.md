# Contributing to verdict

Contributions welcome. This is a straightforward TypeScript project.

## What's useful to contribute

- **New eval packs** in `eval-packs/` covering new domains (coding, reasoning, instruction-following, domain-specific)
- **Provider integrations** for inference servers we don't yet support
- **Reporter improvements** to the terminal or markdown output
- **Bug fixes** with a reproduction case
- **Documentation** for getting started with specific setups

## What to open an issue for first

If you're adding a new feature or changing behavior, open an issue first. Keeps us aligned before you spend time on implementation.

## Setup

```bash
git clone https://github.com/hnshah/verdict
cd verdict
npm install
```

Run in dev mode:

```bash
npm run dev -- init
npm run dev -- models discover
npm run dev -- run --dry-run
```

Typecheck:

```bash
npm run typecheck
```

## Writing eval packs

Eval packs are YAML files in `eval-packs/`. Format:

```yaml
name: My Pack
version: 1.0.0
description: What these cases test

cases:
  - id: pack-001                    # unique within the pack
    prompt: "Your prompt"
    criteria: "What a good answer includes"
    scorer: llm                     # llm (default), json, exact, contains
    expected: "exact string"        # required for exact/contains scorers
    tags: [domain, difficulty]
```

**Scorer types:**
- `llm` (default): uses the configured judge model with rubric scoring
- `json`: deterministic, checks if output parses as valid JSON
- `exact`: deterministic, checks for exact string match (case-insensitive)
- `contains`: deterministic, checks if output contains the expected string

Use deterministic scorers (`json`, `exact`, `contains`) where the correct answer is unambiguous. Use `llm` for prose, reasoning, and explanation tasks.

## Code structure

```
src/
  types/index.ts       Zod schemas for all types
  core/
    config.ts          YAML loader with env var substitution
    runner.ts          Eval runner, concurrency, judging pipeline
  providers/
    compat.ts          Universal OpenAI-compat client
    ollama.ts          Ollama discovery and metadata
    mlx.ts             MLX discovery and metadata
  judge/
    llm.ts             LLM-as-judge with weighted rubric
    deterministic.ts   JSON, exact, contains scorers
  reporter/
    terminal.ts        Colored leaderboard output
    markdown.ts        Markdown report generation
  cli/
    index.ts           Commander entrypoint
    commands/
      init.ts          verdict init
      run.ts           verdict run
      models.ts        verdict models / models discover
```

## PR checklist

- [ ] `npm run typecheck` passes
- [ ] No em dashes in any copy or comments
- [ ] New eval pack cases have unique IDs
- [ ] Deterministic scorer used where appropriate (JSON output, exact match)
- [ ] README updated if adding a user-visible feature

## License

MIT. Your contributions are MIT licensed.
