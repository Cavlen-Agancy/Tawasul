import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/available-dates.get'
import { createApiEvent, expectApiError } from '../helpers'
import { createTestDoctor, deleteTestDoctor, nextDateWithDayOfWeek } from './helpers'
import { prisma } from '~/server/utils/prisma'

describe('GET /api/booking/available-dates', () => {
  const toDeleteDoctors: Array<{ doctorId: string; userId: string }> = []

  afterAll(async () => {
    await Promise.all(toDeleteDoctors.map(({ doctorId, userId }) => deleteTestDoctor(doctorId, userId)))
  })

  async function doctorForDay(dayOfWeek: number) {
    const doctor = await createTestDoctor({
      dayOfWeek,
      startTime: '09:00',
      endTime: '12:00',
      sessionDuration: 60,
    })
    toDeleteDoctors.push({ doctorId: doctor.doctor.id, userId: doctor.user.id })
    return doctor
  }

  it('returns dates for the selected doctor only', async () => {
    const dateStr = nextDateWithDayOfWeek(0)
    const day = new Date(`${dateStr}T00:00:00`).getDay()
    const doctor = await doctorForDay(day)
    const [y, m] = dateStr.split('-').map((v) => parseInt(v, 10))

    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-dates?month=${m}&year=${y}&doctorId=${doctor.doctor.id}`,
    })
    const res = await handler(event) as { dates: string[] }
    expect(res.dates).toContain(dateStr)
  })

  it('requires doctorId', async () => {
    const now = new Date()
    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-dates?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid month, year, or doctor')
    }
  })

  it('rejects an inactive doctor with 404', async () => {
    const dateStr = nextDateWithDayOfWeek(0)
    const day = new Date(`${dateStr}T00:00:00`).getDay()
    const doctor = await doctorForDay(day)
    await prisma.doctor.update({ where: { id: doctor.doctor.id }, data: { isActive: false } })
    const [y, m] = dateStr.split('-').map((v) => parseInt(v, 10))

    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/available-dates?month=${m}&year=${y}&doctorId=${doctor.doctor.id}`,
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 404, 'Doctor not found')
    }
  })
})
