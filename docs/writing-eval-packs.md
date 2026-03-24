# Writing eval packs

Eval packs are portable YAML files. Anyone can write one and share it.

## Format

```yaml
name: My Pack
version: 1.0.0
description: What these cases test

cases:
  - id: pack-001
    prompt: "Your prompt here"
    criteria: "What a good answer must include"
    scorer: llm
    tags: [domain, difficulty]
```

## Scorer types

| Scorer | When to use | How it works |
|--------|-------------|--------------|
| `llm` | Prose, reasoning, explanation | Judge model scores with rubric |
| `json` | Structured output, tool calling | `JSON.parse()` pass or fail |
| `exact` | Single correct answer | Case-insensitive string match |
| `contains` | Answer must include X | Substring check |

Use deterministic scorers (`json`, `exact`, `contains`) wherever the correct answer
is unambiguous. They are faster (no LLM call) and more reliable.

## Writing good criteria

Criteria tell the judge what to look for. Be specific.

Bad:
```yaml
criteria: "A good answer"
```

Good:
```yaml
criteria: |
  Covers: why MoE models activate only a fraction of experts per token,
  what that means for memory requirements, and at least one concrete example
  (Mixtral, DeepSeek, or Qwen3.5). 3-5 sentences.
```

The rubric has three dimensions:
- **Accuracy (0.4 weight):** Is the content correct?
- **Completeness (0.4 weight):** Does it cover the criteria?
- **Conciseness (0.2 weight):** Is it appropriately terse?

Your criteria should map to these dimensions.

## Quantization sensitivity cases

If you want to test whether a model degrades at lower bit depth, structure
cases that require precise structured output:

```yaml
- id: mypack-json-001
  prompt: |
    Return JSON: {"result": <integer>, "unit": "seconds"}
    The result is 42. Output ONLY the JSON.
  criteria: "Valid JSON with result=42 (integer) and unit='seconds' (string)"
  scorer: json
  tags: [json, quantization-sensitive]
```

The `scorer: json` field means the response is scored by `JSON.parse()`, not
an LLM. A 2-bit model that produces `'result'` instead of `"result"` gets 0.
A 4-bit model that produces valid JSON gets 10. No ambiguity.

## Case IDs

Use a prefix + sequential number: `coding-001`, `quant-003`. IDs must be
unique within a run (across all packs). Keep them stable once published.

## Tags

Use tags to filter cases:

```bash
# verdict filter by tag not yet implemented -- use --pack to run specific packs
```

Standard tags: `easy`, `medium`, `hard`, `json`, `coding`, `reasoning`,
`instruction-following`, `quantization-sensitive`, `moe`, `tool-calling`.

## Sharing eval packs

Packs are self-contained YAML. To share one, open a PR adding it to `eval-packs/`
with a description in the pack's YAML header.
