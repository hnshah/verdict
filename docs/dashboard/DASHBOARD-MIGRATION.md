# Dashboard Migration Notes

## What Changed

The built-in `verdict dashboard` CLI command has been **removed** from Verdict to eliminate confusion between two conflicting dashboard systems.

### Before (Conflicting Systems)

1. **Verdict CLI** (`verdict dashboard generate`)
   - Single-file embedded HTML
   - TypeScript implementation
   - Not compatible with multi-page site

2. **Custom Build System** (`dashboard/build/`)
   - Multi-page static site
   - Separate model & run detail pages
   - Node.js implementation
   - GitHub Pages deployment

### After (Single System)

**Only the custom build system remains.**

Location: `dashboard/build/`  
Deployment: https://hnshah.github.io/verdict/

## Migration Guide

### If you were using `verdict dashboard generate`

**Old workflow:**
```bash
verdict dashboard generate --results results/
verdict dashboard preview
```

**New workflow:**
```bash
# Add latest run
./quick-add-run.sh $(ls -t results/*.json | head -1)

# Or manually:
cp results/LATEST.json dashboard/published/data/
./regenerate-dashboard-data.sh
cd dashboard/build && ./rebuild-all.sh
```

### If you need single-file HTML

The custom system generates a multi-page site. If you need a single HTML file:

1. Use the main dashboard page: `dashboard/published/index.html`
2. Or create your own aggregator based on `dashboard-data.json`

### Complete Documentation

See **WORKFLOW.md** for:
- Full dashboard generation process
- Automation scripts
- Troubleshooting

## Removed Files

- `src/cli/commands/dashboard.ts` (backed up to `.removed-dashboard-cli/`)
- `src/cli/commands/__tests__/dashboard.test.ts`
- Dashboard CLI registration in `src/cli/index.ts`

## Why This Change?

**Problem:** Two dashboard systems caused confusion:
- Which one to use?
- Different output formats
- Duplicate documentation
- Maintenance burden

**Solution:** Keep only the actively deployed system (custom build).

**Result:** 
- ✅ Clear, single workflow
- ✅ One system to maintain
- ✅ Matches deployed site
- ✅ Better documentation

---

**Questions?** See WORKFLOW.md or run `./quick-add-run.sh --help`
