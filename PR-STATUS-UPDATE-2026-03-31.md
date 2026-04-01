# PR Status Update - 2026-03-31 19:21 PT

## 🆕 NEW PR (Created Today!)

**OpenCode #18674** - Security fix
- **Title:** vendor Anthropic OAuth plugin and fix PKCE state security issue
- **Status:** Open (0 comments, just submitted)
- **Issue:** Fixes #18652 - 400 invalid_grant error
- **Type:** Security fix (PKCE state vulnerability)
- **Changes:** 3 files, 373+ additions
- **Impact:** Vendors the deprecated npm package and fixes OAuth security

**Next:** Monitor for maintainer response

---

## ✅ APPROVED (Waiting for Merge)

**pnpm #11095** - macOS Gatekeeper fix
- **Status:** APPROVED by zkochan (maintainer)
- **Updated:** 2026-03-27 (5 days ago)
- **Comments:** 8 (strong approval: "It is the right solution")
- **Mergeable:** False (may need rebase?)
- **Next:** Check if rebase needed, ping if stale

---

## ⏳ PENDING REVIEW (7 PRs)

### High Priority (OpenClaw)

1. **openclaw #54990** - Security (prompt injection sanitization)
   - 2 comments, updated Mar 26
   
2. **openclaw #54962** - Telegram inline buttons
   - 1 comment, updated Mar 26

3. **openclaw #52469** - Compaction token override
   - 3 comments, updated Mar 24

4. **openclaw #53451** - Port warning suppression
   - 3 comments, updated Mar 24

### Medium Priority

5. **insanely-fast-whisper #275** - Mac MPS docs
   - 0 comments, updated Mar 26

6. **ollama #15052** - Database VACUUM cleanup
   - 0 comments, updated Mar 25

7. **twenty #18939** - Kanban drag-drop fix
   - 1 comment, updated Mar 25

---

## 🔄 DEFERRED (3 PRs)

**mvanhorn/last30days-skill** - All waiting for v3.0:
- #84 - 90-day scanning window
- #85 - HN/Polymarket storage
- #86 - Webhook delivery

**Status:** Maintainer wants to wait for v3.0 release

---

## 📚 OTHER OPEN (5 PRs)

- **KittenTTS #121** - Model comparison docs (2 comments)
- **basecamp/fizzy #2747** - Filter sort (2 comments)
- **zod #5803** - .or() docs (0 comments)

---

## 🎯 ACTIONS NEEDED

1. **Monitor OpenCode #18674** - Security fix, should get attention
2. **Check pnpm #11095** - May need rebase (mergeable: false)
3. **Follow up on OpenClaw PRs** - 4 PRs pending review for 5-8 days
4. **Hunt for new opportunities** - Fresh repos/issues

---

**Total Open PRs:** 20
**Needs Attention:** 2 (OpenCode new, pnpm approved)
**Updated Today:** 1 (OpenCode #18674)

---

## 📝 UPDATE: pnpm #11095 - Comment Posted (20:01 PT)

**Action Taken:** Posted comment asking maintainer about conflicts

**Comment:** Asked @zkochan if he prefers to handle merge or wants us to rebase

**Reason:**
- PR has complex conflicts (3 recent commits to same file)
- Maintainer most familiar with conflicting changes
- Already approved our PR
- Lower risk of bugs if maintainer handles merge

**Next:** Wait for maintainer response

**URL:** https://github.com/pnpm/pnpm/pull/11095#issuecomment-4167099839

---

## 🎯 Evening Summary

**Completed:**
1. ✅ Checked 20 open PRs
2. ✅ Found 1 new PR (OpenCode #18674 - security fix)
3. ✅ Analyzed pnpm #11095 rebase complexity
4. ✅ Posted comment to maintainer
5. ✅ Identified trending repos for hunting

**Active Monitoring:**
- pnpm #11095 - Waiting for maintainer response
- OpenCode #18674 - Monitoring for feedback (security fix)

**Ready to Hunt:**
- luongnv89/claude-howto (13K ⭐)
- NousResearch/hermes-agent (20K ⭐)
- vas3k/TaxHacker (3.7K ⭐)
