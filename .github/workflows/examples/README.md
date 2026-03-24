# GitHub Actions Examples

Example workflows for running Verdict in CI/CD.

## Available Examples

### `model-comparison.yml.example`

Run Verdict on every PR to catch quality regressions.

**Features:**
- Automatic model comparison on code changes
- Fails PR if quality drops below threshold
- Uploads results as artifacts

**To use:**
1. Copy to `.github/workflows/verdict.yml`
2. Update model names and threshold
3. Commit and push

## Tips

- **Set realistic thresholds:** Start with current baseline, not aspirational goals
- **Cache models:** Use actions/cache for faster runs
- **Parallel execution:** Run multiple eval packs in parallel for speed
- **Store baselines:** Compare against main branch, not absolute scores

## Example: Comparing branches

```yaml
- name: Compare with main
  run: |
    verdict run --pack eval-packs/general.yaml --output pr-results.json
    
    git fetch origin main
    git checkout origin/main
    verdict run --pack eval-packs/general.yaml --output main-results.json
    
    # Compare scores
    verdict compare pr-results.json main-results.json
```

## Local testing

Test workflows locally with [act](https://github.com/nektos/act):

```bash
act pull_request -j verdict
```
