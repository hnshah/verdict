# Verdict Dashboard

Visual dashboard for exploring and sharing evaluation results.

## Structure

```
dashboard/
├── templates/          # HTML templates
│   ├── index.html      # Main dashboard (Brief Design System)
│   └── validate.html   # Data validator
├── published/          # Published dashboard (served via GitHub Pages)
│   ├── index.html      # Generated dashboard with embedded data
│   ├── dashboard-data.json  # Dashboard data (for external loading)
│   ├── runs/           # (legacy per-run pages - not currently used)
│   └── models/         # (legacy per-model pages - not currently used)
└── archive/            # Old build systems (archived for reference)
```

## Usage

### Generate Dashboard

From eval results:

```bash
# Run evals first
verdict run eval-packs/coding.yaml --models qwen2.5:7b,phi4:14b

# Generate dashboard
verdict dashboard generate --results ./results --output ./dashboard-data.json

# Deploy to published/
verdict dashboard deploy --output ./dashboard/published

# Commit and push
git add dashboard/published/ dashboard-data.json
git commit -m "feat: Add new evaluation run"
git push origin main
```

### From Existing dashboard-data.json

If you already have `dashboard-data.json` at repo root:

```bash
# Inject data into template manually
python3 << 'EOF'
import json

with open('dashboard-data.json') as f:
    data = json.load(f)

with open('dashboard/templates/index.html') as f:
    template = f.read()

html = template.replace('/*__DASHBOARD_DATA__*/null', json.dumps(data))

with open('dashboard/published/index.html', 'w') as f:
    f.write(html)

print(f"✅ Dashboard generated with {data['meta']['total_runs']} runs")
EOF

# Then commit and push
git add dashboard/published/index.html
git commit -m "chore: Update dashboard"
git push origin main
```

## Design System

The dashboard uses **Brief Design System**:
- **Font**: Inter (UI), JetBrains Mono (code)
- **Framework**: Tailwind CSS
- **Style**: Clean, minimal, focused on data clarity
- **Colors**: Semantic badges (blue=general, green=pass, amber=warn)

## Deployment

The `dashboard/published/` directory is served via **GitHub Pages**.

To set up:
1. Go to repo **Settings → Pages**
2. Set source to **Deploy from a branch**
3. Branch: **main**, Folder: **/dashboard/published**
4. Save

Dashboard will be live at: `https://<username>.github.io/<repo>/`

## Data Format

`dashboard-data.json` structure:

```json
{
  "meta": {
    "total_runs": 5,
    "total_cases": 10,
    "total_models": 13,
    "last_updated": "2026-03-31"
  },
  "models": {
    "qwen2.5:7b": { "name": "qwen2.5:7b" },
    ...
  },
  "cases": [
    {
      "id": "gen-001",
      "name": "General Question 1",
      "suite": "general",
      "prompt": "What is the capital of France?",
      "runs": [
        {
          "run_id": "2026-03-31T07-48-00",
          "run_meta": {
            "name": "Comprehensive Benchmark",
            "config_file": "verdict.yaml"
          },
          "responses": {
            "qwen2.5:7b": {
              "text": "The capital of France is Paris.",
              "latency_ms": 1198
            }
          },
          "scores": {
            "qwen2.5:7b": {
              "total": 10,
              "reasoning": "Perfect accuracy"
            }
          }
        }
      ]
    }
  ]
}
```

## Adding Runs

**Option 1: Use verdict CLI (recommended)**

```bash
# Run new eval
verdict run eval-packs/reasoning.yaml --models qwen2.5:7b,phi4:14b

# Regenerate dashboard
verdict dashboard generate --results ./results --output ./dashboard-data.json
verdict dashboard deploy --output ./dashboard/published

# Deploy
git add dashboard/ dashboard-data.json
git commit -m "feat: Add reasoning benchmark"
git push origin main
```

**Option 2: Manual injection (when you have dashboard-data.json)**

Just re-run the Python snippet above to inject updated data into the template.

## Validation

Validate dashboard data structure:

```bash
verdict dashboard validate --input dashboard-data.json
```

## Preview Locally

Preview before deploying:

```bash
verdict dashboard preview --input dashboard-data.json --port 3000
# Open http://localhost:3000
```

## Archive

Old build systems are preserved in `dashboard/archive/`:
- `old-build-system/` - Node.js extractors + Liquid templates
- `old-templates/` - Previous plain HTML templates

These are kept for reference but not actively used.

## Contributing

To add your eval results to the public dashboard:

```bash
verdict contribute --result results/my-run.json --author "YourBotName"
```

This uploads your result to the shared dashboard repo without needing git access.
