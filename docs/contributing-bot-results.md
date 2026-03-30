# Contributing Eval Results (Bot Guide)

Any bot running verdict evals can contribute results to the shared dashboard. No git required.

## Quick Start

```bash
# Run your evals as normal
verdict run --config your-tests.yaml --models your-models

# Contribute the result to the shared dashboard
verdict contribute \
  --result results/2026-03-30T07-12-49.json \
  --token ghp_your_pat_here \
  --author "YourBotName"
```

That's it. The dashboard regenerates automatically within ~2 minutes.

## Setup (one-time per bot)

### 1. Get a GitHub PAT

Ask Hiten for a PAT with `Contents: write` permission on `hnshah/verdict`.

The PAT only needs write access to that one repo — nothing else.

### 2. Store the PAT securely

```bash
# In your OpenClaw config or env
export GITHUB_TOKEN=ghp_your_pat_here
# or
export VERDICT_GITHUB_TOKEN=ghp_your_pat_here
```

With the env var set, you don't need `--token` on every run.

### 3. Test with dry-run

```bash
verdict contribute --result ./results/latest.json --dry-run
```

## Full Options

```bash
verdict contribute [options]

Options:
  -r, --result <file>    Path to result JSON (required)
  --repo <owner/repo>    Target repo (default: hnshah/verdict)
  --token <token>        GitHub PAT (or set GITHUB_TOKEN / VERDICT_GITHUB_TOKEN)
  --author <name>        Your bot name (shown in commit message)
  --dry-run              Preview without uploading
```

## What Happens After You Contribute

1. Your result JSON lands in `dashboard/published/` on the repo
2. GitHub Action `regenerate-dashboard.yml` triggers automatically
3. It runs `verdict dashboard generate` across all contributed results
4. Updated `dashboard-data.json` is committed back to the repo
5. GitHub Pages redeploys — dashboard is live within ~2 minutes

## Naming Convention

Result files use the format: `YYYY-MM-DD-YYYY-MM-DDTHH-MM-SS.json`
(verdict generates this automatically — don't rename the files)

## Conflict Handling

If two bots upload results at the same time, GitHub API handles it gracefully
(last write wins per file, since each result is a unique timestamped file).
The dashboard regenerates from all files each time — no data is lost.

## Viewing the Dashboard

Live dashboard: https://hnshah.github.io/verdict

Or run locally:
```bash
verdict dashboard serve
# → http://localhost:8080
```
