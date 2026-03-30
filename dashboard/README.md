# Dashboard

Verdict's visual dashboard for exploring and sharing eval results.

## Directory Structure

```
dashboard/
├── templates/          # HTML templates used by `verdict dashboard generate`
│   ├── index.html      # Main dashboard template
│   └── validate.html   # Data validator template
└── published/          # Committed dashboard snapshots (published via GitHub Pages)
    ├── index.html      # Generated leaderboard
    ├── runs/           # Per-run HTML reports
    ├── models/         # Per-model HTML scorecards
    └── *.json          # Published result data
```

## Usage

```bash
# Generate dashboard from your local results
verdict dashboard generate

# Preview locally
verdict dashboard preview

# Publish a run snapshot
verdict publish --run latest
```

## Deploying

`dashboard/published/` is designed to be served via GitHub Pages or Cloudflare Pages.

The `verdict publish` command copies results into this directory and provides git instructions.
To serve on GitHub Pages, push this directory and set Pages source to `/dashboard/published`.

## Template Development

Edit `dashboard/templates/index.html` to modify the dashboard UI.
The template uses vanilla JS + Tailwind CDN — no build step required.
