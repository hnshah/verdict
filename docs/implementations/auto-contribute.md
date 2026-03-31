# Auto-Contribute Implementation

**Feature:** Auto-contribute eval results after successful runs  
**Implemented:** 2026-03-31  
**Time:** 30 minutes  
**Status:** ✅ Complete

---

## What We Built

Automatically contributes successful eval results to the dashboard when enabled in config.

### Files Changed

1. **src/types/index.ts** - Added settings schema
2. **src/cli/commands/run.ts** - Added auto-contribute logic
3. **verdict-test-auto-contribute.yaml** - Example config

### Code Added

**Config schema:**
```typescript
settings: z.object({
  auto_contribute: z.boolean().default(false),
  contribution_author: z.string().optional(),
}).optional()
```

**Auto-contribute logic:**
```typescript
if (config.settings?.auto_contribute && result.models.length > 0) {
  await tryAutoContribute(`${base}.json`, config, log)
}
```

---

## Configuration

```yaml
settings:
  auto_contribute: true
  contribution_author: "My Bot"

models:
  - id: phi4
    provider: ollama
    model: phi4:14b

judge:
  model: phi4
```

Requires: `GITHUB_TOKEN` or `VERDICT_GITHUB_TOKEN` env var

---

## Behavior

**Enabled + Success:**
- Eval runs → results saved → auto-contribute → dashboard updated

**Enabled + No Token:**
- Eval runs → results saved → warning shown → manual command provided

**Disabled (default):**
- No change to existing behavior

---

## Error Handling

✅ Missing token → warning (doesn't crash)  
✅ Network failure → warning + fallback  
✅ GitHub API error → shows manual command  
✅ Result file is primary (contribution is secondary)

---

## Testing

✅ Builds successfully  
⏳ Unit tests (next)  
⏳ Live test (next)  
⏳ ce:review (14 agents)  
⏳ ce:compound (capture learnings)

---

**Status:** Ready for testing and review
