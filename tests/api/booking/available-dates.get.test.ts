import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/available-dates.get'
import { createApiEvent, expectApiError } from '../helpers'
import { createTestAdminSchedule, deleteTestAdminSchedule, nextDateWithDayOfWeek } from './helpers'

describe('GET /api/booking/available-dates', () => {
  const toDeleteSchedules: string[] = []

  afterAll(async () => {
    await Promise.all(toDeleteSchedules.map((id) => deleteTestAdminSchedule(id)))
  })

  it('returns available dates for a month with admin-schedule availability', async () => {
    const { adminScheduleId } = await createTestAdminSchedule({
      dayOfWeek: dayOfWeekOf(nextDateWithDayOfWeek(0)),
      startTime: '09:00',
      endTime: '10:00',
      sessionDuration: 60,
    })
    toDeleteSchedules.push(adminScheduleId)

    const now = new Date()
    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-dates?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
    })

    const res = await handler(event) as { dates: string[] }
    expect(Array.isArray(res.dates)).toBe(true)
    expect(res.dates.length).toBeGreaterThan(0)
    for (const d of res.dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('rejects an invalid month with 400', async () => {
    const event = createApiEvent({
      method: 'GET',
      url: '/api/booking/available-dates?month=13&year=2024',
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid month or year')
    }
  })

  it('rejects an invalid year with 400', async () => {
    const event = createApiEvent({
      method: 'GET',
      url: '/api/booking/available-dates?month=3&year=20',
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid month or year')
    }
  })
})

function dayOfWeekOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay()
}
