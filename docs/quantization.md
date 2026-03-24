# Quantization testing

When you run a model at lower bit depth (2-bit, 3-bit, Q4, Q5...), inference gets
faster and memory pressure drops. The question is: how much quality did you lose?

The answer varies by task. A 2-bit model may give fluent prose but silently break
JSON output and tool calling. These failure modes don't show up in simple benchmarks.

verdict's `quantization.yaml` pack is designed to surface these failures.

## Background: the flash-moe finding

[flash-moe](https://github.com/danveloper/flash-moe) ran Qwen3.5-397B on a
48GB MacBook M3 Max by streaming MoE expert weights from SSD on demand.
At 2-bit quantization, it reached 5.7 tokens/second. The paper claimed
2-bit output was "indistinguishable" from 4-bit based on three tasks:

- "What is 255 factored?"
- A sorting function in Python
- "Explain probability to a 5-year-old"

Then the author discovered 2-bit broke JSON output and tool calling. Strings
came back with single quotes (`'name'`) instead of double quotes (`"name"`),
making JSON unparseable. The final recommendation was 4-bit for production use.

The three original tasks would not have caught this. The `quantization.yaml`
pack would have caught it on the first case (`quant-001`).

## Using the quantization pack

```bash
# Compare 2-bit vs 4-bit models from the same family
verdict run --pack ./eval-packs/quantization.yaml --models model-2bit,model-4bit
```

In `verdict.yaml`:

```yaml
models:
  - id: model-4bit
    provider: ollama
    model: qwen2.5:7b   # 4-bit quantized
    tags: [local, 4bit]

  - id: model-2bit
    base_url: "http://localhost:8080/v1"   # custom 2-bit server
    api_key: "none"
    model: "qwen2.5-2bit"
    tags: [local, 2bit]
```

## What the pack tests

| Case | Scorer | What it catches |
|------|--------|-----------------|
| quant-001 | json | JSON object output |
| quant-002 | json | JSON array output |
| quant-003 | json | Tool call JSON format |
| quant-004 | llm | Count constraint following |
| quant-005 | llm | Markdown table structure |
| quant-006 | llm | Exact instruction following |
| quant-007 | json | JSON with type coercion |
| quant-008 | llm | Character-level counting |
| quant-009 | llm | Code output precision |
| quant-010 | contains | Single-word output |

The `json` scorer cases are deterministic: `JSON.parse()` pass or fail.
No LLM judge needed, no ambiguity.

## Interpreting results

If your model fails quant-001 through quant-003: not viable for structured
output or tool calling at that quantization level.

If it passes quant-001 through quant-003 but fails quant-004 through quant-007:
structured output works but instruction precision is degraded. May be viable
for prose generation, risky for constrained tasks.

If it passes all 10: viable for production use at that quantization level.
