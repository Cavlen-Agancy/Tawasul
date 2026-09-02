import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/create.post'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { createTestDoctor, deleteTestDoctor, deleteTestBooking, nextDateWithDayOfWeek } from './helpers'

describe('POST /api/booking/create', () => {
  const toDeleteUsers: string[] = []
  const toDeleteBookings: string[] = []
  let doctorUserId: string | null = null
  let doctorId: string | null = null

  afterAll(async () => {
    await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
    if (doctorId && doctorUserId) await deleteTestDoctor(doctorId, doctorUserId)
    await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
  })

  it('creates a booking with a valid slot (patient)', async () => {
    const patient = await createTestUser({ emailVerified: true, email: `create-ok-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)

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
      method: 'POST',
      url: '/api/booking/create',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      body: { date: dateStr, startTime: '09:00', doctorId: fixture.doctor.id },
    })

    const res = await handler(event) as { bookingId: string; amount: number; currency: string }
    expect(res.bookingId).toBeTruthy()
    expect(res.currency).toBe('EGP')
    expect(typeof res.amount).toBe('number')
    toDeleteBookings.push(res.bookingId)
  })

  it('returns 400 when slot is no longer available', async () => {
    const patient = await createTestUser({ emailVerified: true, email: `create-unavail-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/booking/create',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      body: { date: '2099-01-01', startTime: '09:00', doctorId: 'nonexistent-doctor' },
    })

    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'This slot is no longer available')
    }
  })

  it('returns 401 when unauthenticated', async () => {
    const event = createApiEvent({
      method: 'POST',
      url: '/api/booking/create',
      body: { date: '2099-01-01', startTime: '09:00', doctorId: 'doc-1' },
    })
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
      body: { date: '2099-01-01', startTime: '09:00', doctorId: 'doc-1' },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })
})
