# Dashboard Auto-Regeneration System

**Status:** ✅ Working (fixed 2026-03-31)

---

## How It Works

### 1. **Contributor adds results**

```bash
verdict run -c config.yaml --pack eval.yaml
# With auto_contribute: true in config
# OR manually:
verdict contribute --result results/2026-03-31.json
```

**Result:** New JSON file pushed to `dashboard/published/YYYY-MM-DD-run-id.json`

---

### 2. **GitHub Action triggers automatically**

**Trigger:** Any push to `main` that changes `dashboard/published/*.json`

**Workflow:** `.github/workflows/regenerate-dashboard.yml`

**What it does:**
1. ✅ Checks out repo
2. ✅ Installs dependencies
3. ✅ Builds verdict
4. ✅ Runs `dashboard/build/generate-all.sh`
5. ✅ Commits generated HTML back to repo

---

### 3. **generate-all.sh generates HTML**

**Script:** `dashboard/build/generate-all.sh`

**Generates:**
- `dashboard/published/index.html` (main dashboard)
- `dashboard/published/runs/<run-id>/index.html` (run detail pages)
- `dashboard/published/models/<model-id>/index.html` (model detail pages)

**Time:** ~10-30 seconds depending on number of runs

---

### 4. **GitHub Pages serves updated HTML**

**URL:** https://hnshah.github.io/verdict

**Update time:** 1-2 minutes after commit

---

## Flow Diagram

```
verdict contribute
      ↓
  Push JSON to main
      ↓
GitHub Action triggered
      ↓
generate-all.sh runs
      ↓
HTML generated
      ↓
Auto-commit HTML
      ↓
GitHub Pages updates
      ↓
Live dashboard updated!
```

**Total time:** 2-5 minutes from `verdict contribute` to live dashboard

---

## Manual Regeneration

If you need to manually regenerate (for testing or fixes):

```bash
# Local regeneration
cd dashboard/build
./generate-all.sh

# Commit and push
git add ../published/
git commit -m "chore: regenerate dashboard"
git push
```

Or trigger the GitHub Action manually:
1. Go to https://github.com/hnshah/verdict/actions
2. Click "Regenerate Dashboard"
3. Click "Run workflow"

---

## File Structure

```
dashboard/
├── published/
│   ├── *.json                    # Result files (from verdict contribute)
│   ├── index.html                # Main dashboard (generated)
│   ├── runs/
│   │   └── <run-id>/
│   │       └── index.html        # Run detail page (generated)
│   └── models/
│       └── <model-id>/
│           └── index.html        # Model detail page (generated)
└── build/
    ├── generate-all.sh           # Main generation script
    ├── extractors/               # Data extraction scripts
    ├── templates/                # Liquid templates
    └── node_modules/             # Build dependencies
```

---

## Debugging

### Check if workflow ran:
https://github.com/hnshah/verdict/actions/workflows/regenerate-dashboard.yml

### Check workflow logs:
Look for:
- ✅ "Dashboard regeneration complete!"
- Number of files updated
- Commit hash

### If HTML isn't updating:

1. **Check if workflow ran:**
   - Go to Actions tab
   - Look for "Regenerate Dashboard" workflow
   - Check if it succeeded

2. **Check if HTML was committed:**
   ```bash
   git log --oneline | grep "auto-regenerate"
   ```

3. **Check if GitHub Pages is enabled:**
   - Settings → Pages
   - Source: Deploy from branch
   - Branch: main, /dashboard/published

4. **Manual regeneration:**
   ```bash
   cd dashboard/build
   ./generate-all.sh
   git add ../published/
   git commit -m "manual: regenerate dashboard"
   git push
   ```

---

## Recent Fix (2026-03-31)

**Problem:** 
- JSON was being pushed ✅
- Workflow was running ✅
- HTML was being generated ✅
- But HTML wasn't being committed ❌

**Root Cause:**
- File pattern was too broad: `dashboard/published/`
- Needed explicit patterns for HTML files

**Solution:**
```yaml
file_pattern: "dashboard/published/*.html dashboard/published/runs/ dashboard/published/models/"
add_options: '--all'
```

**Result:** HTML now commits automatically! 🎉

---

## Testing

To test the full pipeline:

1. Run a small eval with auto-contribute:
   ```yaml
   settings:
     auto_contribute: true
   ```

2. Run eval:
   ```bash
   verdict run -c test-config.yaml
   ```

3. Check GitHub Actions (should trigger within 10 seconds)

4. Wait 2-3 minutes

5. Refresh https://hnshah.github.io/verdict

6. New run should appear!

---

**Last updated:** 2026-03-31  
**Status:** ✅ Working perfectly!
