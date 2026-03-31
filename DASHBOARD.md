# Dashboard Guide

The Verdict dashboard is a static site that automatically updates with new eval results.

**Live:** https://hnshah.github.io/verdict/

## Running Evals

```bash
# Run a single eval pack
node dist/cli/index.js run eval-packs/coding.yaml --models qwen2.5:7b,llama3.2:3b

# Run multiple packs
node dist/cli/index.js run eval-packs/coding.yaml
node dist/cli/index.js run eval-packs/reasoning.yaml
```

Results are saved to `results/YYYY-MM-DD-*.json`

## Updating the Dashboard

After running evals, rebuild the dashboard:

```bash
cd dashboard/build

# 1. Regenerate dashboard data
node extractors/dashboard.js > data/dashboard.json

# 2. Build dashboard HTML
node build.js data/dashboard.json --template templates/dashboard.html
cp output/dashboard/index.html ../published/index.html

# 3. Build all run pages
for f in ../../results/*.json; do
  ID=$(basename "$f" .json)
  node extractors/run.js "$f" > data/run-temp.json
  node build.js data/run-temp.json --template templates/run.html
  mkdir -p ../published/runs/$ID
  cp output/run-temp/index.html ../published/runs/$ID/
done

# 4. Build model pages (optional but recommended)
for model in $(jq -r '.top_models[].name' data/dashboard.json); do
  safe=$(echo "$model" | sed 's/[:]/-/g; s/[.]/-/g')
  node extractors/model.js "$model" > data/model-temp.json
  node build.js data/model-temp.json --template templates/model.html
  mkdir -p ../published/models/$safe
  cp output/model-temp/index.html ../published/models/$safe/
done
```

## Committing & Deploying

```bash
# Stage changes
git add dashboard/published/ results/

# Commit with descriptive message
git commit -m "feat: Add eval results for [your run name]

- X cases × Y models
- Winner: [model] ([score]/10)
"

# Push to GitHub (triggers auto-deploy to Pages)
git push origin main
```

Dashboard updates automatically via GitHub Actions within ~2 minutes.

## Quick Workflow Script

For convenience, use the build-all script:

```bash
cd dashboard/build
./build-all.sh
```

This rebuilds everything in one command.

## Live Preview

To watch eval progress in real-time:

```bash
./watch-run.sh
```

Shows live leaderboard that updates every 2 seconds.

## Dashboard Structure

```
dashboard/
  build/              # Build system
    extractors/       # Data extraction scripts
    templates/        # Liquid templates
    data/            # Generated JSON
    build.js         # Template renderer
  
  published/          # Output (deployed to GitHub Pages)
    index.html       # Dashboard overview
    runs/            # Run detail pages
    models/          # Model deep-dive pages
```

## Adding New Models

1. Add model to `verdict.yaml`:
```yaml
models:
  - id: your-model:size
    model: your-model:size
    provider: ollama
    base_url: http://localhost:11434/v1
    api_key: none
```

2. Run eval with new model:
```bash
node dist/cli/index.js run eval-packs/coding.yaml --models your-model:size
```

3. Rebuild dashboard (it will auto-detect the new model)

## Tips for Bots

- **Run 5+ cases** to avoid being marked as a test run
- **Use 2+ models** for meaningful comparisons
- **Descriptive names** help dashboard readers understand what you tested
- **Push results** regularly so dashboard stays current
- **Monitor dashboard** at https://hnshah.github.io/verdict/ to see your contributions

## Troubleshooting

**Dashboard not updating?**
- Check GitHub Actions tab for deploy status
- Wait 2-5 minutes for CDN cache to clear
- Force refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

**Run not showing up?**
- Check results/ folder for your JSON file
- Rebuild dashboard with commands above
- Verify git push succeeded

**Models not linking?**
- Rebuild model pages (step 4 above)
- Model names with `:` or `.` are converted to `-` in URLs

## Questions?

See main [README.md](README.md) or open an issue.
