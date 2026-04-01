# Bug Report: Judge Model Validation Fails Even When Model Exists

## Environment
- **verdict version:** 0.2.0
- **OS:** macOS (Darwin 25.3.0 arm64)
- **Node:** v22.22.1
- **Install method:** npm install -g verdict + built from source

## Summary
Judge model validation fails with "not found in models list" error, even when the model IS in the models list. This blocks all eval runs.

## Error Message
```
✖ Judge model 'phi4:14b' not found in models list
```

## Minimal Reproduction

### Config (verdict-minimal.yaml)
```yaml
models:
  - id: phi4
    provider: ollama
    model: phi4:14b
    
judge:
  provider: ollama
  model: phi4:14b
```

### Command
```bash
verdict run -c verdict-minimal.yaml eval-packs/general.yaml
```

### Output
```
verdict run

  Models: phi4
  Judge:  phi4:14b
  Cases: 10 across 1 pack(s)

- Starting...

Pre-loading models...
  ✓ phi4 (3.0s)

All models ready (3.0s total)

   ✖ Judge model 'phi4:14b' not found in models list
```

## What I Tried

### Attempt 1: Match model name exactly
```yaml
models:
  - id: phi4:14b
    provider: ollama
    model: phi4:14b
judge:
  provider: ollama
  model: phi4:14b
```
**Result:** Same error

### Attempt 2: Use ID in judge
```yaml
models:
  - id: phi4
    provider: ollama
    model: phi4:14b
judge:
  id: phi4
  provider: ollama
  model: phi4:14b
```
**Result:** Same error

### Attempt 3: Match judge.model to models[].id
```yaml
models:
  - id: phi4
    provider: ollama
    model: phi4:14b
judge:
  provider: ollama
  model: phi4  # Using ID instead of model name
```
**Result:** (Need to test this)

### Attempt 4: No judge (auto-select)
```yaml
models:
  - id: phi4
    provider: ollama
    model: phi4:14b
# No judge section
```
**Result:** `judge: Required` error

## Analysis

The validation logic appears to be:
1. Judge config specifies `model: "phi4:14b"`
2. Validator searches models list for matching ID
3. Finds `id: "phi4"` but rejects it
4. Error: "phi4:14b not found"

**The mismatch:** Judge is looking for `phi4:14b` but models list has `id: phi4`

## Expected Behavior

One of these should work:

**Option A:** Judge matches against `models[].model`
```yaml
models:
  - id: phi4
    model: phi4:14b  # Judge should match this
judge:
  model: phi4:14b    # Matches models[].model
```

**Option B:** Judge matches against `models[].id`
```yaml
models:
  - id: phi4         # Judge should match this
    model: phi4:14b
judge:
  model: phi4        # Matches models[].id
```

**Option C:** Auto-select judge from models
```yaml
models:
  - id: phi4
    model: phi4:14b
# Judge defaults to first model or model with role: judge
```

## Impact

- **Blocks all eval runs** using custom configs
- Forces use of default verdict.yaml (requires downloading many models)
- Makes it difficult to test with local-only models

## Workaround

None found yet. Will try:
- Setting `judge.model` to `models[].id` instead of model name
- Using default verdict.yaml
- Checking if fixed in main branch

## Additional Context

I'm trying to contribute eval packs back to verdict (elite-python-hardcore.yaml, ocr-extraction.yaml) but can't test them due to this issue.

Would appreciate guidance on correct judge config format!
