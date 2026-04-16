/**
 * Thin wrapper around `cron-parser` so the rest of the codebase can import
 * from a single place. Also normalizes shorthand aliases (`@hourly`, etc.)
 * and swallows parse errors into boolean/null return values.
 */

import parser from 'cron-parser'

/**
 * Compute the next fire time for a cron expression.
 * Supports standard 5-field cron + cron-parser aliases (@hourly, @daily,
 * @weekly, @monthly, @yearly).
 *
 * @param cron   cron expression
 * @param from   reference time (defaults to "now")
 * @returns next fire time, or null if `cron` is invalid
 */
export function nextCronTime(cron: string, from: Date = new Date()): Date | null {
  try {
    const iter = parser.parseExpression(cron, { currentDate: from })
    return iter.next().toDate()
  } catch {
    return null
  }
}

/**
 * Compute the next N fire times for a cron expression. Useful for previewing
 * a schedule in the TUI or `schedule show`.
 */
export function nextCronTimes(cron: string, n: number, from: Date = new Date()): Date[] {
  try {
    const iter = parser.parseExpression(cron, { currentDate: from })
    const out: Date[] = []
    for (let i = 0; i < n; i++) out.push(iter.next().toDate())
    return out
  } catch {
    return []
  }
}

/** Returns true iff `cron` is a parseable, non-empty cron expression. */
export function isValidCron(cron: string): boolean {
  if (!cron || !cron.trim()) return false
  try {
    parser.parseExpression(cron)
    return true
  } catch {
    return false
  }
}

/**
 * Human-readable description of when the schedule will next fire,
 * relative to now. e.g. "in 3h 14m" or "in 2d 4h".
 */
export function describeNext(next: Date, now: Date = new Date()): string {
  const ms = next.getTime() - now.getTime()
  if (ms <= 0) return 'now'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `in ${days}d ${hours % 24}h`
  if (hours > 0) return `in ${hours}h ${minutes % 60}m`
  if (minutes > 0) return `in ${minutes}m ${seconds % 60}s`
  return `in ${seconds}s`
}
