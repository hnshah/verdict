# GitHub Webhook Setup Instructions

**After Tailscale Funnel is running, add these webhooks to GitHub:**

---

## Webhook Configuration

**Webhook Secret:** `55ded718dc5d0845ad634ff6e2e81d725b453c2a6fcfc86c65c1f2c6bda2679d`

**Payload URL:** (Will be provided after Funnel starts)  
Example: `https://macs-mac-studio.tail-scale.ts.net/hooks/github`

---

## Repos to Add Webhooks To

### 1. PyCQA/isort (CRITICAL - Our Active Contribution)

**URL:** https://github.com/PyCQA/isort/settings/hooks/new

**Configuration:**
- **Payload URL:** `https://[YOUR-FUNNEL-URL]/hooks/github`
- **Content type:** `application/json`
- **Secret:** `55ded718dc5d0845ad634ff6e2e81d725b453c2a6fcfc86c65c1f2c6bda2679d`

**Events to subscribe:**
- [x] Issue comments
- [x] Issues  
- [x] Pull requests
- [x] Pull request reviews
- [x] Pull request review comments

**Why:** Get INSTANT notifications when maintainer responds to #1518

---

### 2. ankitvgupta/mail-app (HIGH - Exo Integration)

**URL:** https://github.com/ankitvgupta/mail-app/settings/hooks/new

**Configuration:**
- **Payload URL:** `https://[YOUR-FUNNEL-URL]/hooks/github`
- **Content type:** `application/json`
- **Secret:** `55ded718dc5d0845ad634ff6e2e81d725b453c2a6fcfc86c65c1f2c6bda2679d`

**Events to subscribe:**
- [x] Issues
- [x] Pull requests

**Why:** Discover new issues/PRs in real-time for contribution opportunities

---

## After Adding Webhooks

**Test the webhook:**

1. Go to the webhook settings
2. Click "Recent Deliveries" tab  
3. You should see a "ping" event
4. Click it and verify:
   - ✅ Response code: 200
   - ✅ Response body shows success

**If you see errors:**
- Check Tailscale Funnel is running
- Verify webhook secret matches
- Check OpenClaw gateway is running

---

## What Happens After Webhooks Are Active

**Real-Time Notifications (<1 second):**

**When maintainer responds to isort #1518:**
```
🚨 isort #1518: Maintainer Response!

Author: @maintainer-username
Intent: APPROVE (or DENY/QUESTION)
Time: just now

[Comment summary]

Recommended action: [next step]
```

**When new issue opens in Exo:**
```
🎯 Exo: New Issue!

#11: "Add extension development guide"
Labels: good-first-issue, documentation
Score: 14 (GOOD opportunity)

[Issue summary]

Recommended: Review and consider contribution
```

**Cost:**
- Webhooks: $0.15/month
- Polling backup: $0.15/month  
- Total: **$0.30/month** (down from $1.74!)

---

## Verification Checklist

After adding webhooks:

- [ ] Funnel URL is public and accessible
- [ ] Webhook added to PyCQA/isort
- [ ] Webhook added to ankitvgupta/mail-app  
- [ ] Test "ping" event received (200 OK)
- [ ] Make a test comment on an issue
- [ ] Verify Telegram notification received
- [ ] Check OpenClaw logs show webhook received

---

## Troubleshooting

**Webhook shows "Failed to connect":**
- Check Tailscale Funnel is running: `tailscale status`
- Verify URL is correct
- Test manually: `curl https://your-url/hooks/github`

**Webhook delivers but no notification:**
- Check OpenClaw logs: `openclaw logs --follow`
- Verify webhook secret matches
- Check gateway is running: `openclaw gateway status`

**Getting too many notifications:**
- Adjust event filters in webhook settings
- Update OpenClaw mapping to filter events
- Set notification thresholds

---

**Ready to add webhooks as soon as Funnel is running!** ⚡
