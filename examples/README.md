# Verdict Examples

This directory contains example eval packs to help you get started with Verdict.

## Quick Start

Run any example:

```bash
verdict run --pack examples/basic-comparison.yaml
```

## Available Examples

### `basic-comparison.yaml`
Simple 3-case eval pack for testing basic model capabilities:
- Factual recall
- Technical explanation  
- Creative writing

**Use when:** Getting started with Verdict, testing new models

### `code-quality.yaml`
Code-focused eval pack testing:
- Code generation
- Code review
- Technical explanations

**Use when:** Comparing models for coding tasks

## Creating Your Own

1. Copy an example as a template
2. Modify the cases for your use case
3. Run: `verdict run --pack your-pack.yaml`

See the [main README](../README.md#eval-packs) for full eval pack syntax.

## Tips

- **Start small:** 3-5 cases to iterate quickly
- **Clear criteria:** Specific pass/fail conditions work best
- **Tag your cases:** Makes filtering easier later
- **Test first:** Run on one model before comparing multiple

## More Examples

For more eval packs, see:
- `eval-packs/general.yaml` - Comprehensive general capabilities
- `eval-packs/moe.yaml` - Mixture-of-experts specific tests
