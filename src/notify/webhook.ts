/**
 * Generic webhook POST — JSON body + 5s timeout + single 5xx retry.
 * Slack + Discord accept a bare `text` field; the full structured object is
 * also sent so richer integrations (Zapier, Make, custom) can parse it.
 */

export interface WebhookResult {
  ok: boolean
  status?: number
  error?: string
}

export async function postWebhook(
  url: string,
  payload: Record<string, unknown>,
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<WebhookResult> {
  if (!url) return { ok: false, error: 'empty url' }
  const timeoutMs = opts.timeoutMs ?? 5000
  const maxAttempts = (opts.retries ?? 1) + 1

  let lastError: string | undefined
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(t)
      if (resp.ok) return { ok: true, status: resp.status }
      lastError = `HTTP ${resp.status}`
      // Only retry on transient 5xx; client errors are permanent
      if (resp.status < 500) return { ok: false, status: resp.status, error: lastError }
    } catch (err) {
      clearTimeout(t)
      lastError = err instanceof Error ? err.message : String(err)
    }
  }
  return { ok: false, error: lastError ?? 'unknown error' }
}
