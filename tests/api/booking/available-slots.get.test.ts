import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/available-slots.get'
import { createApiEvent, expectApiError } from '../helpers'
import { createTestAdminSchedule, deleteTestAdminSchedule, createTestBlockedDate, deleteTestBlockedDate, nextDateWithDayOfWeek } from './helpers'

describe('GET /api/booking/available-slots', () => {
  const toDeleteSchedules: string[] = []
  const toDeleteBlockedDates: string[] = []

  afterAll(async () => {
    await Promise.all(toDeleteSchedules.map((id) => deleteTestAdminSchedule(id)))
    await Promise.all(toDeleteBlockedDates.map((id) => deleteTestBlockedDate(id)))
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
    const farDate = '2099-01-01'
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
    // 2027-01-07 is Coptic Christmas (a fixed holiday) and lies in the future.
    const holidayDate = '2027-01-07'
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