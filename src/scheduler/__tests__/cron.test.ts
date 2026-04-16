import { describe, it, expect } from 'vitest'
import { nextCronTime, nextCronTimes, isValidCron, describeNext } from '../cron.js'

describe('cron helper', () => {
  it('computes next time for a standard expression', () => {
    const from = new Date('2026-04-15T08:30:00Z')
    const next = nextCronTime('0 9 * * *', from)
    expect(next).not.toBeNull()
    expect(next!.toISOString()).toBe('2026-04-15T09:00:00.000Z')
  })

  it('supports @hourly alias', () => {
    const from = new Date('2026-04-15T08:30:00Z')
    const next = nextCronTime('@hourly', from)
    expect(next).not.toBeNull()
    expect(next!.toISOString()).toBe('2026-04-15T09:00:00.000Z')
  })

  it('supports @daily alias', () => {
    const from = new Date('2026-04-15T08:30:00Z')
    const next = nextCronTime('@daily', from)
    expect(next).not.toBeNull()
    // @daily = midnight next day (UTC)
    expect(next!.getUTCHours()).toBe(0)
  })

  it('returns null for invalid cron', () => {
    expect(nextCronTime('not a cron', new Date())).toBeNull()
    expect(nextCronTime('60 * * * *', new Date())).toBeNull()
  })

  it('isValidCron flags valid and invalid expressions', () => {
    expect(isValidCron('0 9 * * *')).toBe(true)
    expect(isValidCron('@hourly')).toBe(true)
    expect(isValidCron('not cron')).toBe(false)
    expect(isValidCron('60 * * * *')).toBe(false) // minute field overflow
    expect(isValidCron('')).toBe(false)
  })

  it('nextCronTimes returns N future times in order', () => {
    const from = new Date('2026-04-15T08:00:00Z')
    const times = nextCronTimes('0 */2 * * *', 3, from)
    expect(times).toHaveLength(3)
    expect(times[0].toISOString()).toBe('2026-04-15T10:00:00.000Z')
    expect(times[1].toISOString()).toBe('2026-04-15T12:00:00.000Z')
    expect(times[2].toISOString()).toBe('2026-04-15T14:00:00.000Z')
  })

  it('nextCronTimes returns [] for invalid input', () => {
    expect(nextCronTimes('garbage', 5)).toEqual([])
  })

  it('describeNext formats relative time', () => {
    const now = new Date('2026-04-15T00:00:00Z')
    expect(describeNext(new Date('2026-04-15T00:00:30Z'), now)).toMatch(/in \d+s/)
    expect(describeNext(new Date('2026-04-15T00:05:00Z'), now)).toMatch(/in 5m/)
    expect(describeNext(new Date('2026-04-15T03:15:00Z'), now)).toMatch(/in 3h 15m/)
    expect(describeNext(new Date('2026-04-17T00:00:00Z'), now)).toMatch(/in 2d/)
    expect(describeNext(new Date('2026-04-14T00:00:00Z'), now)).toBe('now')
  })
})
