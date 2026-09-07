import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/[id].get'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { deleteTestBooking, nextDateWithDayOfWeek } from './helpers'

interface Fixture {
  bookingId: string
  ownerId: string
}

async function createBookingFixture(): Promise<Fixture> {
  const owner = await createTestUser({ emailVerified: true, email: `id-owner-${Date.now()}@test.com` })
  const dateStr = nextDateWithDayOfWeek(0)
  const [gy, gm, gd] = dateStr.split('-').map((p) => parseInt(p, 10))
  const booking = await prisma.booking.create({
    data: {
      userId: owner.id,
      doctorId: null,
      date: new Date(Date.UTC(gy, gm - 1, gd)),
      startTime: '09:00',
      endTime: '10:00',
      service: 'Marital Counseling',
      status: 'PENDING',
    },
  })
  return { bookingId: booking.id, ownerId: owner.id }
}

async function cleanup(f: Fixture, userIds: string[]) {
  await deleteTestBooking(f.bookingId)
  await Promise.all(userIds.map((id) => deleteTestUser(id)))
}

describe('GET /api/booking/:id', () => {
  it('fetches own booking as patient (no doctor assigned yet)', async () => {
    const f = await createBookingFixture()
    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/${f.bookingId}`,
      context: { params: { id: f.bookingId }, user: { userId: f.ownerId, email: "x", accountType: "PATIENT" } },
    })
    const res = await handler(event) as { id: string; patientName: string; status: string; doctorId: string | null; doctorName: string | null }
    expect(res.id).toBe(f.bookingId)
    expect(res.patientName).toBeTruthy()
    expect(res.status).toBe('PENDING')
    expect(res.doctorId).toBeNull()
    expect(res.doctorName).toBeNull()
    await cleanup(f, [f.ownerId])
  })

  it('returns 403 fetching another user\'s booking', async () => {
    const f = await createBookingFixture()
    const other = await createTestUser({ emailVerified: true, email: `id-other-${Date.now()}@test.com` })
    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/${f.bookingId}`,
      context: { params: { id: f.bookingId }, user: { userId: other.id, email: 'x', accountType: 'PATIENT' } },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
    await cleanup(f, [f.ownerId, other.id])
  })

  it('fetches as STAFF with APPOINTMENTS READ permission', async () => {
    const f = await createBookingFixture()
    const staff = await createTestUser({
      emailVerified: true,
      accountType: 'STAFF',
      email: `id-staff-${Date.now()}@test.com`,
      permissions: [{ resource: 'APPOINTMENTS', action: 'READ' }],
    })
    const event = createApiEvent({
      method: 'GET',
      url: `/api/booking/${f.bookingId}`,
      context: { params: { id: f.bookingId }, user: { userId: staff.id, email: 'x', accountType: 'STAFF' } },
    })
    const res = await handler(event) as { id: string }
    expect(res.id).toBe(f.bookingId)
    await cleanup(f, [f.ownerId, staff.id])
  })

  it('returns 401 unauthenticated', async () => {
    const event = createApiEvent({ method: 'GET', url: '/api/booking/some-id' })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 401, 'Unauthorized')
    }
  })

  it('returns 404 for nonexistent booking', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `id-notfound-${Date.now()}@test.com` })
    const event = createApiEvent({
      method: 'GET',
      url: '/api/booking/nonexistent',
      context: { params: { id: 'nonexistent' }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 404, 'Booking not found')
    }
    await deleteTestUser(owner.id)
  })
})
