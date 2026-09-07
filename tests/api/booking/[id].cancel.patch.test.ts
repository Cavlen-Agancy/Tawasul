import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/[id]/cancel.patch'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { deleteTestBooking } from './helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []

async function createBooking(ownerId: string, date: Date, startTime: string, status: 'PENDING' | 'CONFIRMED' = 'PENDING'): Promise<string> {
  const booking = await prisma.booking.create({
    data: {
      userId: ownerId,
      doctorId: null,
      date,
      startTime,
      endTime: '10:00',
      service: 'Marital Counseling',
      status,
    },
  })
  await prisma.payment.create({
    data: { bookingId: booking.id, amount: 100, currency: 'EGP', status: 'PENDING' },
  })
  toDeleteBookings.push(booking.id)
  return booking.id
}

afterAll(async () => {
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('PATCH /api/booking/:id/cancel', () => {
  it('cancels own booking 24h+ before session', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `cancel-ok-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000)
    const bookingId = await createBooking(owner.id, future, '09:00')

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}/cancel`,
      context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })
    const res = await handler(event) as { message: string }
    expect(res.message).toBe('Booking cancelled successfully')

    const updated = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(updated?.status).toBe('CANCELLED')
  })

  it('rejects cancelling a CONFIRMED booking less than 24h before', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `cancel-soon-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const bookingId = await createBooking(owner.id, soon, '09:00', 'CONFIRMED')

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}/cancel`,
      context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Cannot cancel booking less than 24 hours before session')
    }
  })

  it('allows cancelling a PENDING booking less than 24h before (no restriction)', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `cancel-pendingsoon-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const bookingId = await createBooking(owner.id, soon, '09:00', 'PENDING')

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}/cancel`,
      context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })
    const res = await handler(event) as { message: string }
    expect(res.message).toBe('Booking cancelled successfully')

    const updated = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(updated?.status).toBe('CANCELLED')
  })

  it('allows STAFF to cancel with APPOINTMENTS DELETE permission', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `cancel-staffowner-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const staff = await createTestUser({
      emailVerified: true,
      accountType: 'STAFF',
      email: `cancel-staff-${Date.now()}@test.com`,
      permissions: [{ resource: 'APPOINTMENTS', action: 'DELETE' }],
    })
    toDeleteUsers.push(staff.id)
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const bookingId = await createBooking(owner.id, soon, '09:00')

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}/cancel`,
      context: { params: { id: bookingId }, user: { userId: staff.id, email: 'x', accountType: 'STAFF' } },
    })
    const res = await handler(event) as { message: string }
    expect(res.message).toBe('Booking cancelled successfully')
  })

  it('rejects cancelling another user\'s booking', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `cancel-anowner-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const other = await createTestUser({ emailVerified: true, email: `cancel-other-${Date.now()}@test.com` })
    toDeleteUsers.push(other.id)
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000)
    const bookingId = await createBooking(owner.id, future, '09:00')

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}/cancel`,
      context: { params: { id: bookingId }, user: { userId: other.id, email: 'x', accountType: 'PATIENT' } },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })
})
