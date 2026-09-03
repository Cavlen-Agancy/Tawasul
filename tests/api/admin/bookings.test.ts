import { describe, expect, it, afterAll } from 'vitest'
import pendingHandler from '~/modules/admin/server/api/admin/bookings/pending.get'
import assignHandler from '~/modules/admin/server/api/admin/bookings/[id]/assign.patch'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { deleteTestBooking, nextDateWithDayOfWeek } from '../booking/helpers'
import { createTestAdminDoctor, deleteTestAdminDoctor } from './helpers'
import { createTestAdminSchedule, deleteTestAdminSchedule } from '../booking/helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []
const toDeleteDoctors: Array<{ doctorId: string; userId: string }> = []
const toDeleteSchedules: string[] = []

function staffContext(userId: string) {
  return { user: { userId, email: 'staff@test.com', accountType: 'STAFF' } }
}

async function staffWith(permission: string): Promise<{ id: string }> {
  const staff = await createTestUser({
    emailVerified: true,
    accountType: 'STAFF',
    email: `ap-staff-${Date.now()}@test.com`,
    permissions: [{ resource: 'APPOINTMENTS', action: permission }],
  })
  toDeleteUsers.push(staff.id)
  return { id: staff.id }
}

async function createPendingBooking(): Promise<{ bookingId: string; ownerId: string; date: Date }> {
  const owner = await createTestUser({ emailVerified: true, email: `ap-patient-${Date.now()}@test.com` })
  toDeleteUsers.push(owner.id)
  const dateStr = nextDateWithDayOfWeek(0)
  const date = new Date(`${dateStr}T00:00:00`)
  const booking = await prisma.booking.create({
    data: { userId: owner.id, doctorId: null, date, startTime: '09:00', endTime: '10:00', service: 'Marital Counseling', status: 'PENDING' },
  })
  await prisma.payment.create({ data: { bookingId: booking.id, amount: 500, currency: 'EGP', status: 'PENDING' } })
  toDeleteBookings.push(booking.id)
  return { bookingId: booking.id, ownerId: owner.id, date }
}

afterAll(async () => {
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await Promise.all(toDeleteDoctors.map((d) => deleteTestAdminDoctor(d.doctorId, d.userId)))
  await Promise.all(toDeleteSchedules.map((id) => deleteTestAdminSchedule(id)))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('GET /api/admin/bookings/pending', () => {
  it('returns only PENDING bookings with doctorId null', async () => {
    const staff = await staffWith('READ')
    const leader = await createPendingBooking()

    const res = await pendingHandler(createApiEvent({
      method: 'GET',
      url: '/api/admin/bookings/pending',
      context: staffContext(staff.id),
    })) as { bookings: Array<{ id: string }> }

    const found = res.bookings.find((b) => b.id === leader.bookingId)
    expect(found).toBeTruthy()
  })

  it('returns 403 without APPOINTMENTS READ permission', async () => {
    const staff = await createTestUser({ emailVerified: true, accountType: 'STAFF', email: `ap-noperm-${Date.now()}@test.com` })
    toDeleteUsers.push(staff.id)
    try {
      await pendingHandler(createApiEvent({ method: 'GET', url: '/api/admin/bookings/pending', context: staffContext(staff.id) }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'You do not have permission to perform this action')
    }
  })
})

describe('PATCH /api/admin/bookings/:id/assign', () => {
  it('assigns a doctor and changes status to CONFIRMED', async () => {
    const staff = await staffWith('UPDATE')
    const doctor = await createTestAdminDoctor()
    toDeleteDoctors.push(doctor)
    const { bookingId } = await createPendingBooking()

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/admin/bookings/${bookingId}/assign`,
      context: { params: { id: bookingId }, ...staffContext(staff.id) },
      body: { doctorId: doctor.doctor.id },
    })
    const res = await assignHandler(event) as { booking: { doctorId: string | null; status: string } }
    expect(res.booking.doctorId).toBe(doctor.doctor.id)
    expect(res.booking.status).toBe('CONFIRMED')

    const updated = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(updated?.status).toBe('CONFIRMED')
  })

  it('returns 400 if booking is not PENDING', async () => {
    const staff = await staffWith('UPDATE')
    const doctor = await createTestAdminDoctor()
    toDeleteDoctors.push(doctor)
    const owner = await createTestUser({ emailVerified: true, email: `ap-confinc-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const date = new Date(`${nextDateWithDayOfWeek(1)}T00:00:00`)
    const booking = await prisma.booking.create({
      data: { userId: owner.id, doctorId: doctor.doctor.id, date, startTime: '09:00', endTime: '10:00', service: 'Marital Counseling', status: 'CONFIRMED' },
    })
    toDeleteBookings.push(booking.id)

    try {
      await assignHandler(createApiEvent({
        method: 'PATCH',
        url: `/api/admin/bookings/${booking.id}/assign`,
        context: { params: { id: booking.id }, ...staffContext(staff.id) },
        body: { doctorId: doctor.doctor.id },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Only PENDING bookings can be assigned')
    }
  })

  it('returns 400 if doctor is inactive', async () => {
    const staff = await staffWith('UPDATE')
    const owner = await createTestUser({ emailVerified: true, email: `ap-inactdocowner-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const doctor = await createTestAdminDoctor()
    await prisma.doctor.update({ where: { id: doctor.doctor.id }, data: { isActive: false } })
    toDeleteDoctors.push(doctor)
    const { bookingId } = await createPendingBooking()

    try {
      await assignHandler(createApiEvent({
        method: 'PATCH',
        url: `/api/admin/bookings/${bookingId}/assign`,
        context: { params: { id: bookingId }, ...staffContext(staff.id) },
        body: { doctorId: doctor.doctor.id },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Doctor not found or inactive')
    }
  })

  it('returns 400 if doctor has a conflicting CONFIRMED booking', async () => {
    const staff = await staffWith('UPDATE')
    const doctor = await createTestAdminDoctor()
    toDeleteDoctors.push(doctor)
    const owner = await createTestUser({ emailVerified: true, email: `ap-conflictowner-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const dateStr = nextDateWithDayOfWeek(2)
    const date = new Date(`${dateStr}T00:00:00`)
    await prisma.booking.create({
      data: { userId: owner.id, doctorId: doctor.doctor.id, date, startTime: '09:00', endTime: '10:00', service: 'Marital Counseling', status: 'CONFIRMED' },
    })
    const { bookingId } = await createPendingBooking()
    // Move the pending booking onto the same date/time as the doctor's confirmed one.
    await prisma.booking.update({ where: { id: bookingId }, data: { date, startTime: '09:00', endTime: '10:00' } })

    try {
      await assignHandler(createApiEvent({
        method: 'PATCH',
        url: `/api/admin/bookings/${bookingId}/assign`,
        context: { params: { id: bookingId }, ...staffContext(staff.id) },
        body: { doctorId: doctor.doctor.id },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Doctor already has a booking at this time')
    }
  })

  it('returns 403 without APPOINTMENTS UPDATE permission', async () => {
    const staff = await createTestUser({ emailVerified: true, accountType: 'STAFF', email: `ap-nownupd-${Date.now()}@test.com` })
    toDeleteUsers.push(staff.id)
    const { bookingId } = await createPendingBooking()

    try {
      await assignHandler(createApiEvent({
        method: 'PATCH',
        url: `/api/admin/bookings/${bookingId}/assign`,
        context: { params: { id: bookingId }, ...staffContext(staff.id) },
        body: { doctorId: 'any-doctor' },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'You do not have permission to perform this action')
    }
  })
})