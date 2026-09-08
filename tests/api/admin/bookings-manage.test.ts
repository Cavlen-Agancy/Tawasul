import { describe, expect, it, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import getHandler from '~/modules/admin/server/api/admin/bookings/[id].get'
import cancelHandler from '~/modules/admin/server/api/admin/bookings/[id]/cancel.patch'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { deleteTestBooking } from '../booking/helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []

function staffContext(userId: string) {
  return { user: { userId, email: 'staff@test.com', accountType: 'STAFF' } }
}

async function staffWithDelete(): Promise<string> {
  const staff = await createTestUser({
    emailVerified: true,
    accountType: 'STAFF',
    email: `abm-staff-${Date.now()}-${Math.random()}@test.com`,
    permissions: [
      { resource: 'APPOINTMENTS', action: 'READ' },
      { resource: 'APPOINTMENTS', action: 'DELETE' },
    ],
  })
  toDeleteUsers.push(staff.id)
  return staff.id
}

async function createConfirmedBooking(): Promise<string> {
  const patient = await createTestUser({ emailVerified: true, email: `abm-p-${Date.now()}-${Math.random()}@test.com` })
  toDeleteUsers.push(patient.id)
  const booking = await prisma.booking.create({
    data: {
      userId: patient.id,
      doctorId: null,
      date: new Date('2030-08-10T00:00:00'),
      startTime: '10:00',
      endTime: '11:00',
      service: 'Online Consultation',
      status: 'CONFIRMED',
    },
  })
  await prisma.payment.create({ data: { bookingId: booking.id, amount: 500, currency: 'EGP', status: 'SUCCESS' } })
  toDeleteBookings.push(booking.id)
  return booking.id
}

afterAll(async () => {
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('GET /api/admin/bookings/:id', () => {
  it('returns full booking detail', async () => {
    const staffId = await staffWithDelete()
    const bookingId = await createConfirmedBooking()
    const res = await getHandler(createApiEvent({
      method: 'GET',
      url: `/api/admin/bookings/${bookingId}`,
      context: { params: { id: bookingId }, ...staffContext(staffId) },
    })) as { id: string; paymentStatus: string }
    expect(res.id).toBe(bookingId)
    expect(res.paymentStatus).toBe('SUCCESS')
  })

  it('returns 404 for unknown booking', async () => {
    const staffId = await staffWithDelete()
    try {
      await getHandler(createApiEvent({
        method: 'GET',
        url: '/api/admin/bookings/nope',
        context: { params: { id: 'nope' }, ...staffContext(staffId) },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 404, 'Booking not found')
    }
  })
})

describe('PATCH /api/admin/bookings/:id/cancel', () => {
  it('cancels and refunds without a 24h restriction', async () => {
    const staffId = await staffWithDelete()
    const bookingId = await createConfirmedBooking()
    const res = await cancelHandler(createApiEvent({
      method: 'PATCH',
      url: `/api/admin/bookings/${bookingId}/cancel`,
      context: { params: { id: bookingId }, ...staffContext(staffId) },
    })) as { message: string }
    expect(res.message).toBe('Booking cancelled successfully')

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    const payment = await prisma.payment.findUnique({ where: { bookingId } })
    expect(booking?.status).toBe('CANCELLED')
    expect(payment?.status).toBe('REFUNDED')
  })

  it('returns 400 when already cancelled', async () => {
    const staffId = await staffWithDelete()
    const bookingId = await createConfirmedBooking()
    await cancelHandler(createApiEvent({
      method: 'PATCH',
      url: `/api/admin/bookings/${bookingId}/cancel`,
      context: { params: { id: bookingId }, ...staffContext(staffId) },
    }))
    try {
      await cancelHandler(createApiEvent({
        method: 'PATCH',
        url: `/api/admin/bookings/${bookingId}/cancel`,
        context: { params: { id: bookingId }, ...staffContext(staffId) },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Booking is already cancelled')
    }
  })

  it('refunds SUCCESS payment, but leaves PENDING and FAILED payments unchanged', async () => {
    const staffId = await staffWithDelete()
    const patient = await createTestUser({ emailVerified: true, email: `abm-pay-${Date.now()}-${Math.random()}@test.com` })
    toDeleteUsers.push(patient.id)

    // Booking with PENDING payment
    const pendingBooking = await prisma.booking.create({
      data: {
        userId: patient.id,
        date: new Date('2030-08-11T00:00:00'),
        startTime: '11:00',
        endTime: '12:00',
        service: 'Online Consultation',
        status: 'CONFIRMED',
      },
    })
    toDeleteBookings.push(pendingBooking.id)
    await prisma.payment.create({
      data: { bookingId: pendingBooking.id, amount: 500, currency: 'EGP', status: 'PENDING' },
    })

    // Booking with FAILED payment
    const failedBooking = await prisma.booking.create({
      data: {
        userId: patient.id,
        date: new Date('2030-08-12T00:00:00'),
        startTime: '12:00',
        endTime: '13:00',
        service: 'Online Consultation',
        status: 'CONFIRMED',
      },
    })
    toDeleteBookings.push(failedBooking.id)
    await prisma.payment.create({
      data: { bookingId: failedBooking.id, amount: 500, currency: 'EGP', status: 'FAILED' },
    })

    // Cancel pending booking
    await cancelHandler(createApiEvent({
      method: 'PATCH',
      url: `/api/admin/bookings/${pendingBooking.id}/cancel`,
      context: { params: { id: pendingBooking.id }, ...staffContext(staffId) },
    }))

    // Cancel failed booking
    await cancelHandler(createApiEvent({
      method: 'PATCH',
      url: `/api/admin/bookings/${failedBooking.id}/cancel`,
      context: { params: { id: failedBooking.id }, ...staffContext(staffId) },
    }))

    const pendingPayAfter = await prisma.payment.findUnique({ where: { bookingId: pendingBooking.id } })
    expect(pendingPayAfter?.status).toBe('PENDING')

    const failedPayAfter = await prisma.payment.findUnique({ where: { bookingId: failedBooking.id } })
    expect(failedPayAfter?.status).toBe('FAILED')
  })
})
