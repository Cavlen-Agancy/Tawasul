import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/create.post'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { createTestDoctor, deleteTestDoctor, deleteTestBooking, nextDateWithDayOfWeek } from './helpers'

describe('POST /api/booking/create', () => {
  const toDeleteUsers: string[] = []
  const toDeleteDoctors: Array<{ doctorId: string; userId: string }> = []
  const toDeleteBookings: string[] = []

  afterAll(async () => {
    await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
    await Promise.all(toDeleteDoctors.map(({ doctorId, userId }) => deleteTestDoctor(doctorId, userId)))
    await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
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

  it('creates an online booking for the selected doctor', async () => {
    const patient = await createTestUser({ emailVerified: true, email: `create-ok-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const dateStr = nextDateWithDayOfWeek(0)
    const doctor = await doctorFor(dateStr)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/booking/create',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      body: { doctorId: doctor.doctor.id, date: dateStr, startTime: '09:00', sessionType: 'ONLINE' },
    })

    const res = await handler(event) as { bookingId: string; doctorId: string; amount: number; currency: string; sessionType: string }
    expect(res.bookingId).toBeTruthy()
    expect(res.doctorId).toBe(doctor.doctor.id)
    expect(res.currency).toBe('EGP')
    expect(res.sessionType).toBe('ONLINE')
    expect(typeof res.amount).toBe('number')
    toDeleteBookings.push(res.bookingId)

    const stored = await prisma.booking.findUnique({ where: { id: res.bookingId } })
    expect(stored?.doctorId).toBe(doctor.doctor.id)
    expect(stored?.status).toBe('PENDING')
    expect(stored?.holdExpiresAt).toBeTruthy()
  })

  it('creates an in-clinic booking immediately confirmed without payment', async () => {
    const patient = await createTestUser({ emailVerified: true, email: `create-clinic-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const dateStr = nextDateWithDayOfWeek(0)
    const doctor = await doctorFor(dateStr)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/booking/create',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      body: { doctorId: doctor.doctor.id, date: dateStr, startTime: '10:00', sessionType: 'IN_CLINIC' },
    })

    const res = await handler(event) as { bookingId: string; amount: number; sessionType: string }
    expect(res.sessionType).toBe('IN_CLINIC')
    expect(res.amount).toBe(0)
    toDeleteBookings.push(res.bookingId)

    const stored = await prisma.booking.findUnique({ where: { id: res.bookingId }, include: { payment: true } })
    expect(stored?.status).toBe('CONFIRMED')
    expect(stored?.payment).toBeNull()
  })

  it('rejects an unknown or inactive doctor', async () => {
    const patient = await createTestUser({ emailVerified: true, email: `create-baddoc-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const dateStr = nextDateWithDayOfWeek(0)
    const doctor = await doctorFor(dateStr)
    await prisma.doctor.update({ where: { id: doctor.doctor.id }, data: { isActive: false } })

    const event = createApiEvent({
      method: 'POST',
      url: '/api/booking/create',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      body: { doctorId: doctor.doctor.id, date: dateStr, startTime: '09:00' },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Doctor is not available')
    }
  })

  it('requires doctorId', async () => {
    const patient = await createTestUser({ emailVerified: true, email: `create-nodoc-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const event = createApiEvent({
      method: 'POST',
      url: '/api/booking/create',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      body: { date: nextDateWithDayOfWeek(0), startTime: '09:00' },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid request')
    }
  })

  it('returns 401 when unauthenticated', async () => {
    const event = createApiEvent({ method: 'POST', url: '/api/booking/create', body: {} })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 401, 'Unauthorized')
    }
  })

  it('returns 403 when authenticated as a doctor', async () => {
    const doctor = await createTestUser({ emailVerified: true, accountType: 'DOCTOR', email: `create-doctor-${Date.now()}@test.com` })
    toDeleteUsers.push(doctor.id)
    const event = createApiEvent({
      method: 'POST',
      url: '/api/booking/create',
      context: { user: { userId: doctor.id, email: doctor.email, accountType: 'DOCTOR' } },
      body: { doctorId: 'x', date: '2099-01-01', startTime: '09:00' },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })
})
