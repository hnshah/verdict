# Eval Packs — Extras

Packs that aren't part of Verdict's 15 canonical decision-oriented packs but
that ship for reference. They fall into three buckets:

1. **Academic benchmarks** — `arc.yaml`, `gsm8k.yaml`, `hellaswag-hf.yaml`,
   `mmlu.yaml`, `truthfulqa.yaml`, `mbpp.yaml`, `humaneval*.yaml`,
   `arc-hf.yaml`, `gsm8k-hf.yaml`. Useful for sanity-checking against
   published numbers, not for picking a model for *your* workload. For that,
   write a pack from your real prompts.

2. **Narrow / domain-specific** — `bias-detection.yaml`, `legal-reasoning.yaml`,
   `medical-clinical.yaml`, `financial-reasoning.yaml`, `customer-support.yaml`,
   `ocr-extraction.yaml`, etc. Good starting points if you happen to be in
   that domain; otherwise noise.

3. **Sub-clusters of canonical packs** — `python-coding.yaml`,
   `python-elite.yaml`, and `cli-building.yaml` overlap with
   `code-generation.yaml`. `counterfactual-reasoning.yaml`,
   `temporal-reasoning.yaml`, `scientific-reasoning.yaml`, etc., overlap
   with `reasoning.yaml`.

## Canonical packs (in `../eval-packs/`)

`agent-planning`, `code-generation`, `code-review`, `coding`,
`comprehensive-mix`, `creative-writing`, `debugging`, `format-compliance`,
`general`, `hallucination-robustness`, `instruction-following`,
`integration-test`, `json-extraction`, `math`, `moe`, `multi-turn`,
`quantization`, `rag-evaluation`, `reasoning`, `safety`, `sql-generation`,
`summarization`, `tool-avoidance`.

## Using an extras pack

```bash
verdict run --pack ./eval-packs/extras/mmlu.yaml
```

Same as any other pack — there's no functional difference. The split is
purely about reducing the cognitive load of the default `eval-packs/`
listing.
