import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/available-slots.get'
import { createApiEvent, expectApiError } from '../helpers'
import { createTestAdminSchedule, deleteTestAdminSchedule, restoreSeedWeekendSchedules, createTestBlockedDate, deleteTestBlockedDate, nextDateWithDayOfWeek } from './helpers'
import { isHoliday } from '~/server/utils/holidays'

describe('GET /api/booking/available-slots', () => {
  const toDeleteSchedules: string[] = []
  const toDeleteBlockedDates: string[] = []

  afterAll(async () => {
    await Promise.all(toDeleteSchedules.map((id) => deleteTestAdminSchedule(id)))
    await Promise.all(toDeleteBlockedDates.map((id) => deleteTestBlockedDate(id)))
    await restoreSeedWeekendSchedules()
  })

  it('returns slots for a date covered by the admin schedule', async () => {
    const dateStr = nextDateWithDayOfWeek(0)
    const { adminScheduleId } = await createTestAdminSchedule({
      dayOfWeek: new Date(`${dateStr}T00:00:00`).getDay(),
      startTime: '09:00',
      endTime: '12:00',
      sessionDuration: 60,
    })
    toDeleteSchedules.push(adminScheduleId)

    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${dateStr}`,
    })

    const res = await handler(event) as { slots: Array<{ startTime: string; endTime: string; sessionDuration: number }> }
    expect(Array.isArray(res.slots)).toBe(true)
    expect(res.slots.length).toBeGreaterThan(0)
    expect(res.slots[0]).toHaveProperty('startTime')
    expect(res.slots[0]).toHaveProperty('endTime')
    expect(res.slots[0]).toHaveProperty('sessionDuration')
    // No doctorId on admin slots.
    expect(res.slots[0]).not.toHaveProperty('doctorId')
  })

  it('returns slots for a Saturday covered by the weekend schedule', async () => {
    // The seed covers Saturdays (09:00-17:00). Pick a future non-holiday
    // Saturday so the assertion is time-robust.
    let dateStr = nextDateWithDayOfWeek(6)
    for (let i = 0; i < 8 && isHoliday(dateStr); i++) {
      const [y, m, d] = dateStr.split('-').map((p) => parseInt(p, 10))
      const next = new Date(Date.UTC(y, m - 1, d + 7))
      dateStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
    }
    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${dateStr}`,
    })

    const res = await handler(event) as { slots: Array<{ startTime: string; endTime: string; sessionDuration: number }> }
    expect(res.slots.length).toBeGreaterThan(0)
    expect(res.slots[0]).toHaveProperty('startTime')
    expect(res.slots[0]).toHaveProperty('endTime')
    expect(res.slots[0]).toHaveProperty('sessionDuration')
  })

  it('rejects an invalid date format with 400', async () => {
    const event = createApiEvent({
      method: 'GET',
      url: '/api/booking/available-slots?date=04-03-2024',
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid date format')
    }
  })

  it('returns empty slots for a date with no availability', async () => {
    // 2027-01-07 is Coptic Christmas (a Thursday public holiday): holidays
    // short-circuit slot generation regardless of the admin schedule, which
    // now covers all 7 days.
    const farDate = '2027-01-07'
    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${farDate}`,
    })
    const res = await handler(event) as { slots: unknown[] }
    expect(res.slots).toEqual([])
  })

  it('returns empty slots on a globally blocked date', async () => {
    const dateStr = nextDateWithDayOfWeek(0)
    const { adminScheduleId } = await createTestAdminSchedule({
      dayOfWeek: new Date(`${dateStr}T00:00:00`).getDay(),
      startTime: '09:00',
      endTime: '12:00',
      sessionDuration: 60,
    })
    toDeleteSchedules.push(adminScheduleId)

    const blockedId = await createTestBlockedDate(dateStr)
    toDeleteBlockedDates.push(blockedId)

    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${dateStr}`,
    })
    const res = await handler(event) as { slots: unknown[] }
    expect(res.slots).toEqual([])
  })

  it('returns empty slots on a public holiday even with a schedule', async () => {
    // 2027-06-05 is Islamic New Year (a fixed holiday) on a Saturday. It lies in
    // the future; the upsert below merges into the seeded Saturday row and
    // `restoreSeedWeekendSchedules()` repairs it in `afterAll`.
    const holidayDate = '2027-06-05'
    const { adminScheduleId } = await createTestAdminSchedule({
      dayOfWeek: new Date(`${holidayDate}T00:00:00`).getDay(),
      startTime: '09:00',
      endTime: '12:00',
      sessionDuration: 60,
    })
    toDeleteSchedules.push(adminScheduleId)

    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${holidayDate}`,
    })
    const res = await handler(event) as { slots: unknown[] }
    // A public holiday blocks all slots regardless of the admin schedule.
    expect(res.slots).toEqual([])
  })
})