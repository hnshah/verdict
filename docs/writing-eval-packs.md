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

## Multi-assertion cases

When a single case needs to satisfy multiple criteria (valid JSON AND
contains a key AND scores well on an LLM rubric), use `assertions: []`
instead of a single `scorer`. Verdict scores each assertion and combines
them per the case's `aggregation` mode.

```yaml
cases:
  - id: structured-extract
    prompt: "Extract author and year from: 'Pride and Prejudice by Jane Austen, 1813.'"
    criteria: "Return JSON with author and year."
    aggregation: weighted   # min (default) | max | avg | weighted
    assertions:
      - scorer: json                                   # must be valid JSON
        weight: 1
      - scorer: jsonschema                             # must match the schema
        schema:
          required: [author, year]
          properties:
            author: { type: string }
            year: { type: integer }
        weight: 2
      - scorer: contains                               # year must be present verbatim
        expected: "1813"
        weight: 1
```

### Aggregation modes

| Mode | Behavior | Use when |
|---|---|---|
| `min` (default) | Worst assertion wins. One failure tanks the score. | Compound assertions where every condition must pass (CI gates). |
| `max` | Best assertion wins. | Multiple valid solution paths — pick whichever one the response matches. |
| `avg` | Mean of assertion scores. | Equal-weight quality dimensions (style, correctness, conciseness). |
| `weighted` | Per-assertion `weight` field, normalized. | One assertion matters more than others (LLM rubric > regex sanity check). |

A response that scores `[10, 0]` on two assertions yields:
- `min` → 0
- `max` → 10
- `avg` → 5
- `weighted [3, 1]` → 7.5 (normalized to `[0.75, 0.25]`)

## Sharing eval packs

Packs are self-contained YAML. To share one, open a PR adding it to `eval-packs/`
with a description in the pack's YAML header.
