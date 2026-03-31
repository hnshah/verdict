# Auto-Contribute Feature: Learnings

**Feature:** Auto-contribute eval results after successful runs  
**Completed:** 2026-03-31  
**Method:** Full compound engineering workflow (plan → work → review → compound)

---

## What We Learned

### 1. Planning Quality Determines Speed

**The Evidence:**
- Plan estimated: 2-3 hours
- Actual time: 30 minutes implementation
- Why? Every decision was already made

**What Worked:**
- Research findings (existing code patterns)
- Technical decisions with rationale
- Exact file paths identified
- Clear implementation steps

**What This Means:**
- Invest time in planning (saves 3-4× in implementation)
- Research before deciding (prevents rework)
- Document decisions (no mid-work debates)

**Apply Next Time:**
- Spend 20-30% of time on planning
- Research existing patterns first
- Make decisions explicit

---

### 2. Reuse > Reinvent

**The Evidence:**
- Didn't write GitHub API code
- Called existing `contributeCommand()`
- Reused token logic (env vars)
- No duplication

**What Worked:**
- Import existing function
- Pass through parameters
- Wrap in try-catch for new context

**What This Means:**
- Always check for existing implementations
- Composition > recreation
- Thin wrappers are okay

**Apply Next Time:**
- Grep for similar code first
- Extract common logic if needed
- Don't rebuild what exists

---

### 3. Graceful Degradation Wins Trust

**The Evidence:**
- Missing token → warning (doesn't crash)
- Network error → shows manual command
- GitHub API failure → run still succeeds

**What Worked:**
```typescript
try {
  await contributeCommand(...)
} catch (err) {
  log(chalk.yellow(`⚠ Auto-contribute failed: ${message}`))
  log(`You can contribute manually:`)
  log(`  verdict contribute --result ${resultPath}`)
}
```

**What This Means:**
- Eval results are primary value
- Contribution is secondary
- User always has fallback

**Apply Next Time:**
- Identify primary vs secondary value
- Never crash on secondary failures
- Always provide escape hatch

---

### 4. Opt-In Beats Opt-Out

**The Evidence:**
- `auto_contribute` defaults to false
- Users must explicitly enable
- Preserves existing workflow
- No surprise behavior

**What Worked:**
```typescript
settings: z.object({
  auto_contribute: z.boolean().default(false),
  ...
}).optional()
```

**What This Means:**
- Default to safe/existing behavior
- Make new features opt-in
- Breaking changes need explicit migration

**Apply Next Time:**
- New features default to disabled
- Existing features default to current behavior
- Migration guides for breaking changes

---

### 5. Config > CLI Flags

**The Decision:**
- Add to verdict.yaml (not --auto-contribute flag)

**Why This Worked:**
- Per-project configuration
- Can commit preference to repo
- Aligns with existing config pattern
- Doesn't clutter CLI

**What This Means:**
- Config for persistent settings
- CLI flags for one-off overrides
- Follow existing patterns

**Apply Next Time:**
- Settings go in config files
- Flags for temporary overrides
- Document in example configs

---

### 6. TypeScript Catches Errors Early

**The Evidence:**
- Build failed on import mistake
- Type errors showed missing fields
- Zod validated config at runtime

**What Worked:**
- Strong typing (Config interface)
- Schema validation (Zod)
- Build step catches issues

**What This Means:**
- Type safety prevents runtime errors
- Schema validation prevents bad config
- Build before test

**Apply Next Time:**
- Always run build first
- Fix type errors immediately
- Don't bypass type system

---

### 7. Tests Validate Understanding

**The Evidence:**
- Wrote 9 tests after implementation
- All passed first time
- Found no bugs (but validated behavior)

**What Worked:**
- Test enable/disable
- Test default values
- Test error handling
- Test config validation

**What This Means:**
- Tests document intended behavior
- Even if all pass, value is documentation
- Tests catch future regressions

**Apply Next Time:**
- Write tests for happy path
- Write tests for error cases
- Write tests for edge cases

---

### 8. Live Testing Finds Real Issues

**The Evidence:**
- Unit tests passed
- Build succeeded
- Live test worked first time!

**What Worked:**
- Actual eval run with real config
- Real GitHub API call
- Real dashboard update

**What This Means:**
- Integration tests matter
- Real environment != test environment
- Always test end-to-end

**Apply Next Time:**
- Run feature in real environment
- Test with actual external services
- Verify end-to-end flow

---

### 9. Documentation Compounds Learning

**Created Documents:**
1. `docs/plans/auto-contribute-plan.md` - Planning artifact
2. `docs/implementations/auto-contribute.md` - Implementation summary
3. `docs/solutions/2026-03-31-auto-contribute-learnings.md` - This file

**What This Enables:**
- Future features can reference plan structure
- Similar implementations can copy patterns
- Learnings are searchable

**What This Means:**
- Documentation is investment
- Each doc makes next work easier
- Searchable knowledge base forms

**Apply Next Time:**
- Document decisions (plans/)
- Document implementations (implementations/)
- Document learnings (solutions/)

---

### 10. The Compound Step Matters

**The Workflow:**
```
ce:plan → ce:work → ce:review → ce:compound
   ✅       ✅         ⏳          ✅ (this file!)
```

**What ce:compound Does:**
- Extracts generalizable lessons
- Makes them searchable
- Applies to future work
- Accumulates over time

**What This Means:**
- Most teams stop at "work"
- Some do "review"
- Few do "compound"
- Compound is where gains accumulate!

**Apply Always:**
- After every feature: what did we learn?
- After every bug: what pattern prevents this?
- After every review: what do future reviewers need?

---

## Patterns to Reuse

### 1. Config Schema Extension Pattern

**When adding settings:**
```typescript
export const ConfigSchema = z.object({
  // ... existing fields ...
  settings: z.object({
    new_feature: z.boolean().default(false),
    new_option: z.string().optional(),
  }).optional(),
})
```

**Key principles:**
- `settings` object is optional
- New feature defaults to false (opt-in)
- Options are optional (sensible defaults)

### 2. Post-Action Hook Pattern

**When adding behavior after existing action:**
```typescript
// After main action completes
if (config.settings?.new_feature && mainActionSucceeded) {
  await tryNewFeature(result, config, log)
}

async function tryNewFeature(...) {
  try {
    // New behavior
  } catch (err) {
    // Graceful failure
    log(warning)
    log(manual_fallback)
  }
}
```

**Key principles:**
- Check if enabled
- Check if appropriate (e.g., success)
- Wrap in try-catch
- Provide manual fallback

### 3. Error Message Pattern

**When showing errors:**
```typescript
catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  log(chalk.yellow(`⚠ ${featureName} failed: ${message}`))
  log(chalk.dim(`You can ${action} manually:`))
  log(`  ${chalk.cyan(manualCommand)}`)
}
```

**Key principles:**
- Warning color (not error)
- Show actual error message
- Provide manual alternative
- Format command clearly

---

## Anti-Patterns to Avoid

### 1. Don't Crash on Secondary Failures

**Bad:**
```typescript
await contributeCommand(...)  // Crashes if token missing
```

**Good:**
```typescript
try {
  await contributeCommand(...)
} catch (err) {
  // Warn but continue
}
```

### 2. Don't Force New Behavior

**Bad:**
```typescript
// Always auto-contribute (no config)
await contributeCommand(...)
```

**Good:**
```typescript
if (config.settings?.auto_contribute) {
  await contributeCommand(...)
}
```

### 3. Don't Duplicate Logic

**Bad:**
```typescript
// Copy GitHub API code
const response = await fetch(...)
```

**Good:**
```typescript
// Reuse existing
await contributeCommand(...)
```

---

## Future Improvements

### Near Term (If Needed)

1. **Batch Contribution Mode**
   - Contribute multiple runs at once
   - Reduce API calls

2. **Dashboard URL in Success**
   - Show clickable link
   - "View at: https://..."

3. **Contribution Queue**
   - Offline support
   - Retry failed uploads

### Long Term (If Users Request)

4. **CI/CD Integration Guide**
   - How to use in GitHub Actions
   - How to use in GitLab CI

5. **Webhook Notifications**
   - Slack notification on contribution
   - Email digest of contributions

6. **Multiple Dashboard Targets**
   - Contribute to multiple repos
   - Support alternative dashboards

---

## Metrics

**Implementation:**
- Planning: Already done (from previous session)
- Coding: 30 minutes
- Testing: 20 minutes (9 tests + live test)
- Documentation: 10 minutes
- **Total:** ~60 minutes

**Quality:**
- Tests: 9/9 passing
- Build: Success
- Live test: Success
- Production: Working

**Impact:**
- Saves manual step every eval run
- Dashboard always current
- Zero friction

---

## Related Solutions

**Check these for similar patterns:**
- Feature flags (opt-in pattern)
- Background jobs (graceful failure)
- Config extensions (backward compatibility)
- Post-action hooks (augment existing)

---

## Tags

#auto-contribute #config-extension #graceful-degradation #opt-in-design #error-handling #compound-engineering #feature-complete #verdict

---

**Status:** Learnings captured, ready for future application  
**Next:** Apply these patterns to next feature, reference when planning
