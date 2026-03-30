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
## How Data Gets Into the Dashboard

The dashboard supports two data loading modes:

### Mode 1: Baked-in data (default)
`verdict dashboard generate` injects data directly into the HTML at build time.
The resulting HTML is fully self-contained — no server needed, works offline.
```bash
verdict dashboard generate --output my-results.html
```

### Mode 2: Dynamic load (for static deployments like Cloudflare Pages)
Deploy the template HTML + a `dashboard-data.json` file in the same directory.
The dashboard will fetch the JSON automatically on load.
```bash
# Generate the data file
verdict dashboard generate  # outputs dashboard-data.json

# Then deploy both files:
# dashboard/templates/index.html → your hosting root
# dashboard-data.json → same directory as index.html
```

This is the right approach for Vera-style Cloudflare Pages deployments where
you want to update data without redeploying the HTML template.
