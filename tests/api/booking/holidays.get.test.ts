import { describe, expect, it } from 'vitest'
import handler from '~/modules/booking/server/api/booking/holidays.get'
import { isHoliday } from '~/server/utils/holidays'
import { createApiEvent, expectApiError } from '../helpers'

describe('GET /api/booking/holidays', () => {
  it('returns fixed Egyptian holidays for January', async () => {
    const event = createApiEvent({ method: 'GET', url: '/api/booking/holidays?month=1&year=2026' })
    const res = await handler(event) as { holidays: Array<{ date: string; name: string }> }
    const names = res.holidays.map((h) => h.name)
    expect(names).toContain('Coptic Christmas')
    expect(names).toContain('Revolution Day (Jan 25)')
    expect(res.holidays[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns Coptic Easter Monday derived from Easter', async () => {
    const event = createApiEvent({ method: 'GET', url: '/api/booking/holidays?month=4&year=2026' })
    const res = await handler(event) as { holidays: Array<{ date: string; name: string }> }
    expect(res.holidays.some((h) => h.date === '2026-04-06' && h.name === 'Coptic Easter Monday')).toBe(true)
  })

  it('rejects an invalid month with 400', async () => {
    const event = createApiEvent({ method: 'GET', url: '/api/booking/holidays?month=13&year=2026' })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid month or year')
    }
  })

  it('rejects an invalid year with 400', async () => {
    const event = createApiEvent({ method: 'GET', url: '/api/booking/holidays?month=1&year=20' })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid month or year')
    }
  })

  it('isHoliday matches getEgyptianHolidays', () => {
    expect(isHoliday('2026-01-07')?.name).toBe('Coptic Christmas')
    expect(isHoliday('2026-01-06')).toBeNull()
  })
})