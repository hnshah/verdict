# Verdict Eval Run Configs

**Hardware:** Apple M2 Max, 64GB RAM (macs164)  
**Author:** Rak

## Config Organization

### Priority Runs (Execute First)
- `run1-gsm8k.yaml` ✅ IN PROGRESS - GSM8K × 5 general models
- `run2-gsm8k-reasoning.yaml` - GSM8K × reasoning specialists
- `run4-humaneval-code-specialists.yaml` - HumanEval × 4 code models
- `run5-humaneval-general.yaml` - HumanEval × 3 general models
- `run7-mbpp-code-specialists.yaml` - MBPP × 4 code models
- `run8-mbpp-general.yaml` - MBPP × 3 general models
- `run10-qwen7b-all-benchmarks.yaml` - Qwen 7B comprehensive
- `run11-deepseek-all-benchmarks.yaml` - DeepSeek comprehensive
- `run12-qwen32b-all-benchmarks.yaml` - Qwen 32B comprehensive
- `run35-general-workflow-all.yaml` - Universal baseline (10 models)
- `run65-general-workflow-universal.yaml` - ALL models baseline

### Phase 2: Code Evaluation
- `run13-coding-specialists.yaml` - Existing coding pack

### Phase 3: Reasoning & Knowledge
- `run25-reasoning-all.yaml` - Reasoning pack × 5 models
- `run26-failure-modes.yaml` - Robustness testing

## Usage

```bash
# Run evaluation
npm run dev -- run --config configs/runX.yaml

# Contribute results
npm run dev -- contribute --result results/YYYY-MM-DD-*.json --author "Rak" --token $GITHUB_TOKEN

# Check progress (during run)
tail -f results/.verdict-checkpoint.json
```

## Execution Strategy

1. **Phase 1** (Runs 1-12, 35) - Validate HF benchmarks
2. **Run 65** - Ultimate baseline
3. **Phase 2-6** - Systematic coverage

**See:** `../COMPREHENSIVE-RUN-MATRIX.md` for full plan (65 runs)
