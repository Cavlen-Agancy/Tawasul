import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/available-slots.get'
import { createApiEvent, expectApiError } from '../helpers'
import { createTestDoctor, deleteTestDoctor, createTestBlockedDate, deleteTestBlockedDate, nextDateWithDayOfWeek } from './helpers'
import { prisma } from '~/server/utils/prisma'

describe('GET /api/booking/available-slots', () => {
  const toDeleteDoctors: Array<{ doctorId: string; userId: string }> = []
  const toDeleteBlockedDates: string[] = []

  afterAll(async () => {
    await Promise.all(toDeleteDoctors.map(({ doctorId, userId }) => deleteTestDoctor(doctorId, userId)))
    await Promise.all(toDeleteBlockedDates.map((id) => deleteTestBlockedDate(id)))
  })

  async function doctorFor(dateStr: string) {
    const doctor = await createTestDoctor({
      dayOfWeek: new Date(`${dateStr}T00:00:00`).getDay(),
      startTime: '09:00',
      endTime: '12:00',
      sessionDuration: 60,
    })
    toDeleteDoctors.push({ doctorId: doctor.doctor.id, userId: doctor.user.id })
    return doctor
  }

  it('returns slots for the selected doctor only', async () => {
    const dateStr = nextDateWithDayOfWeek(0)
    const doctor = await doctorFor(dateStr)

    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${dateStr}&doctorId=${doctor.doctor.id}`,
    })

    const res = await handler(event) as { slots: Array<{ doctorId: string; startTime: string; endTime: string; sessionDuration: number }> }
    expect(res.slots.length).toBeGreaterThan(0)
    expect(res.slots.every((slot) => slot.doctorId === doctor.doctor.id)).toBe(true)
    expect(res.slots[0]).toHaveProperty('sessionDuration')
  })

  it('rejects an inactive doctor with 404', async () => {
    const dateStr = nextDateWithDayOfWeek(0)
    const doctor = await doctorFor(dateStr)
    await prisma.doctor.update({ where: { id: doctor.doctor.id }, data: { isActive: false } })

    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${dateStr}&doctorId=${doctor.doctor.id}`,
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 404, 'Doctor not found')
    }
  })

  it('requires doctorId', async () => {
    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${nextDateWithDayOfWeek(0)}`,
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid date or doctor')
    }
  })

  it('returns empty slots on a globally blocked date for that doctor', async () => {
    const dateStr = nextDateWithDayOfWeek(0)
    const doctor = await doctorFor(dateStr)
    const blockedId = await createTestBlockedDate(dateStr)
    toDeleteBlockedDates.push(blockedId)

    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${dateStr}&doctorId=${doctor.doctor.id}`,
    })
    const res = await handler(event) as { slots: unknown[] }
    expect(res.slots).toEqual([])
  })
})
