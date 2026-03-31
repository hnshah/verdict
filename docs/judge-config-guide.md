# Judge Configuration Guide

The judge model validates and scores test responses. Getting the config right is critical but can be confusing.

## TL;DR

**Use the model ID, not the model name:**

```yaml
models:
  - id: phi4           # ← This is the ID
    model: phi4:14b    # ← This is the model name

judge:
  provider: ollama
  model: phi4          # ✅ Use the ID!
```

---

## The Common Mistake

### ❌ Wrong (Uses Model Name)

```yaml
models:
  - id: phi4
    provider: ollama
    model: phi4:14b

judge:
  provider: ollama
  model: phi4:14b      # ❌ This will fail!
```

**Error:**
```
✖ Judge model 'phi4:14b' not found in models list
```

### ✅ Right (Uses Model ID)

```yaml
models:
  - id: phi4
    provider: ollama
    model: phi4:14b

judge:
  provider: ollama
  model: phi4          # ✅ Matches models[].id
```

**Works!**

---

## Why This Happens

The judge validator:
1. Looks at `judge.model` value
2. Searches `models[]` array for matching **ID**
3. Fails if no ID matches

**It does NOT match against `models[].model`!**

This is confusing because:
- `model:` appears in both places
- Naturally you want to use the actual model name
- The error message doesn't explain ID vs name

---

## Examples

### Anthropic Cloud Model

```yaml
models:
  - id: sonnet
    provider: anthropic
    model: claude-sonnet-4-5

judge:
  provider: anthropic
  model: sonnet        # ✅ Use ID 'sonnet'
  # NOT: claude-sonnet-4-5
```

### Multiple Models, One Judge

```yaml
models:
  - id: fast
    provider: ollama
    model: qwen2.5:7b

  - id: smart
    provider: ollama
    model: qwen3-coder:30b

judge:
  provider: ollama
  model: smart         # ✅ Use any model's ID
```

### Same Name as Model

```yaml
models:
  - id: phi4:14b       # ID matches model name
    provider: ollama
    model: phi4:14b

judge:
  provider: ollama
  model: phi4:14b      # ✅ Works (ID happens to match)
```

---

## Best Practices

### 1. Use Short, Clear IDs

```yaml
models:
  - id: fast           # ✅ Clear and short
    model: qwen2.5:7b

  - id: qwen2.5:7b     # ❌ Unnecessarily long
    model: qwen2.5:7b
```

### 2. Pick a Capable Judge

The judge needs to:
- Understand evaluation criteria
- Give consistent scores
- Be fast enough (it runs on every response)

**Good judges:**
- Larger models (they understand nuance)
- Models with strong reasoning
- Fast enough for your workflow

**Trade-off:**
- Smaller judge = faster evals
- Larger judge = better scoring

### 3. Test Judge Quality

Run the same eval with different judges:

```bash
# Try phi4 as judge
verdict run -c config-phi4-judge.yaml

# Try qwen3-coder as judge
verdict run -c config-qwen3-judge.yaml

# Compare score distributions
```

### 4. Match Judge to Task

**Code tasks:** Use a coder model as judge
```yaml
judge:
  model: qwen-coder    # Understands code quality
```

**Writing tasks:** Use a language model
```yaml
judge:
  model: claude        # Understands prose
```

---

## Troubleshooting

### "Judge model not found"

**Check:**
1. Is `judge.model` using an ID from `models[]`?
2. Did you spell the ID correctly?
3. Is the ID actually in your models list?

**Fix:**
```yaml
# List your model IDs
models:
  - id: model-a
  - id: model-b

# Use one of those IDs
judge:
  model: model-a       # ✅
```

### "Judge: Required"

You forgot the judge section entirely.

**Fix:**
```yaml
judge:
  provider: ollama
  model: <some-model-id>
```

### Judge Gives Weird Scores

**Possible causes:**
1. Judge model too small (can't evaluate well)
2. Criteria too vague (judge guessing)
3. Judge biased toward certain styles

**Fix:**
- Try a larger judge model
- Make criteria more specific
- Compare multiple judges

---

## FAQ

**Q: Can I use the same model as both test subject and judge?**

A: Yes! In fact, this is common for single-model testing:

```yaml
models:
  - id: phi4
    model: phi4:14b

judge:
  model: phi4          # Same model judges itself
```

**Q: Should judge be the best model?**

A: Usually yes - better models give more accurate scores. But consider speed/cost trade-offs.

**Q: Do I need multiple judges?**

A: No, one judge is enough. But testing with multiple judges can reveal biases.

**Q: What if I want auto-select judge?**

A: Not supported yet - you must specify a judge model.

---

## Summary

**Key Rule:** `judge.model` = model ID, not model name

**Quick checklist:**
- [ ] Judge model references a `models[].id`
- [ ] ID is spelled correctly
- [ ] Judge model is capable enough
- [ ] Judge is fast enough for your workflow

**When stuck:**
- Check model IDs: `models[].id`
- Use one of those IDs in `judge.model`
- Test with `verdict run --dry-run` first

---

**Need help?** File an issue with your config and error message!
