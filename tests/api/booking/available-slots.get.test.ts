import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/available-slots.get'
import { createApiEvent, expectApiError } from '../helpers'
import { createTestDoctor, deleteTestDoctor, nextDateWithDayOfWeek } from './helpers'

describe('GET /api/booking/available-slots', () => {
  let doctorUserId: string | null = null
  let doctorId: string | null = null

  afterAll(async () => {
    if (doctorId && doctorUserId) await deleteTestDoctor(doctorId, doctorUserId)
  })

  it('returns slots for a date with availability', async () => {
    const dateStr = nextDateWithDayOfWeek(0)
    const fixture = await createTestDoctor({
      dayOfWeek: new Date(`${dateStr}T00:00:00`).getDay(),
      startTime: '09:00',
      endTime: '12:00',
      sessionDuration: 60,
    })
    doctorId = fixture.doctor.id
    doctorUserId = fixture.user.id

    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${dateStr}`,
    })

    const res = await handler(event) as { slots: Array<{ doctorId: string; startTime: string; endTime: string }> }
    expect(Array.isArray(res.slots)).toBe(true)
    expect(res.slots.length).toBeGreaterThan(0)
    expect(res.slots.some((s) => s.doctorId === fixture.doctor.id)).toBe(true)
    expect(res.slots[0]).toHaveProperty('startTime')
    expect(res.slots[0]).toHaveProperty('endTime')
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
})
