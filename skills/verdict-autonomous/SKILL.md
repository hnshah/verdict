# verdict autonomous eval skill

Run verdict evals on a schedule, detect regressions, and post results to Slack.

## Triggers

- `/verdict run` — run evals on demand
- `/verdict status` — show latest baseline and recent results
- Cron: weekly eval run with Slack reporting

## Setup

1. Install verdict: `npm install -g verdict`
2. Create config: `verdict init`
3. Save a baseline: `verdict run && verdict baseline save default`
4. Set environment variables:
   - `SLACK_WEBHOOK_URL` — Slack incoming webhook for result cards
   - Provider API keys as needed (e.g. `OPENROUTER_API_KEY`, `PERPLEXITY_API_KEY`)

## Cron template

```yaml
# verdict-schedule.yaml — add to your CI or cron system
name: "Weekly verdict eval"
schedule: "0 9 * * 1"  # Every Monday at 9am

steps:
  - name: Run evals with synthesis
    run: |
      verdict run \
        --config ./verdict.yaml \
        --question "Which model gives the best quality for the cost this week?" \
        --resume
    env:
      OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
      PERPLEXITY_API_KEY: ${{ secrets.PERPLEXITY_API_KEY }}

  - name: Post to Slack
    run: |
      CARD=$(ls -t results/*.slack-card.json | head -1)
      if [ -f "$CARD" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
          -H 'Content-type: application/json' \
          -d @"$CARD"
      fi
    env:
      SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Agent instructions

When asked to run verdict autonomously:

```bash
# 1. Run evals with auto-resume and synthesis
verdict run --question "Which model is best for the cost?" --resume

# 2. Check for regressions (auto-compares against 'default' baseline)
# Regression alerts appear in terminal output and slack card

# 3. Update baseline if results look good
verdict baseline save default

# 4. List saved baselines
verdict baseline list

# 5. Compare against a specific baseline
verdict baseline compare mybaseline
```

### Slack output format

When `output.formats` includes `slack` in verdict.yaml, a `.slack-card.json` file is written alongside results:

```json
{
  "winner": "model-id",
  "winnerScore": 8.5,
  "runId": "2026-03-25T09-00-00",
  "synthesis": {
    "verdict": "CLEAR",
    "recommendation": "sonar-pro leads by 1.2pts; worth the 3x cost for production use.",
    "confidence": "HIGH",
    "keyFinding": "sonar-pro scored 8.5 vs sonar's 7.3 on accuracy-heavy cases",
    "caveats": "Only 10 cases tested; latency not factored into recommendation"
  },
  "regressionAlert": false,
  "markdownPath": "./results/2026-03-25-run.md"
}
```

### Reading results

Parse the JSON result file for programmatic access:
- `summary.<model_id>.avg_total` — overall score (0-10)
- `summary.<model_id>.win_rate` — percentage of cases won
- `baselineComparison.regressionAlert` — true if any model dropped > 0.5pts
- `synthesis.verdict` — CLEAR / LEAN / INCONCLUSIVE

### Regression handling

If `regressionAlert` is true:
1. Report which models regressed and by how much
2. Suggest re-running with `--resume` if the run was interrupted
3. If regression persists, recommend investigating the specific cases that changed
4. Do NOT auto-update the baseline when regressions are detected
