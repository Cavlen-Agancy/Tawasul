import { describe, expect, it, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import profileHandler from '~/modules/doctor/server/api/doctor/profile.get'
import patchHandler from '~/modules/doctor/server/api/doctor/profile.patch'
import bookingsHandler from '~/modules/doctor/server/api/doctor/bookings.get'
import bookingDetailHandler from '~/modules/doctor/server/api/doctor/bookings/[id].get'
import sessionHandler from '~/modules/doctor/server/api/doctor/session/[bookingId].get'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { deleteTestBooking } from '../booking/helpers'
import { createTestAdminDoctor, deleteTestAdminDoctor } from '../admin/helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []
const toDeleteDoctors: Array<{ user: { id: string }; doctor: { id: string } }> = []

function doctorContext(userId: string) {
  return { user: { userId, email: 'doctor@test.com', accountType: 'DOCTOR' } }
}

afterAll(async () => {
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await Promise.all(toDeleteDoctors.map((d) => deleteTestAdminDoctor(d.doctor.id, d.user.id)))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('GET /api/doctor/profile', () => {
  it('returns 401 without auth', async () => {
    try {
      await profileHandler(createApiEvent({ method: 'GET', url: '/api/doctor/profile', context: {} }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 401, 'Unauthorized')
    }
  })

  it('returns the doctor profile with 200', async () => {
    const fixture = await createTestAdminDoctor()
    toDeleteDoctors.push(fixture)
    const res = await profileHandler(createApiEvent({
      method: 'GET',
      url: '/api/doctor/profile',
      context: doctorContext(fixture.user.id),
    })) as { slug: string; specializations: string[] }
    expect(res.slug).toBeTruthy()
    expect(res.specializations).toContain('Marital Counseling')
  })

  it('returns 404 when the user has no doctor row', async () => {
    const user = await createTestUser({ accountType: 'DOCTOR', emailVerified: true, email: `dr-norow-${Date.now()}@test.com` })
    toDeleteUsers.push(user.id)
    try {
      await profileHandler(createApiEvent({
        method: 'GET',
        url: '/api/doctor/profile',
        context: doctorContext(user.id),
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 404, 'Doctor profile not found')
    }
  })
})

describe('PATCH /api/doctor/profile', () => {
  it('updates name, bio and specializations', async () => {
    const fixture = await createTestAdminDoctor()
    toDeleteDoctors.push(fixture)
    const res = await patchHandler(createApiEvent({
      method: 'PATCH',
      url: '/api/doctor/profile',
      body: { name: 'Dr. Updated', bio: 'New bio', specializations: ['Family'] },
      context: doctorContext(fixture.user.id),
    })) as { name: string; bio: string; specializations: string[] }
    expect(res.name).toBe('Dr. Updated')
    expect(res.bio).toBe('New bio')
    expect(res.specializations).toEqual(['Family'])
  })
})

describe('GET /api/doctor/bookings', () => {
  it('returns bookings in the requested range', async () => {
    const fixture = await createTestAdminDoctor()
    toDeleteDoctors.push(fixture)
    const patient = await createTestUser({ emailVerified: true, email: `dr-bk-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const booking = await prisma.booking.create({
      data: {
        userId: patient.id,
        doctorId: fixture.doctor.id,
        date: new Date('2030-05-10T00:00:00'),
        startTime: '10:00',
        endTime: '11:00',
        service: 'Online Consultation',
        status: 'CONFIRMED',
      },
    })
    toDeleteBookings.push(booking.id)

    const res = await bookingsHandler(createApiEvent({
      method: 'GET',
      url: '/api/doctor/bookings?start=2030-05-01&end=2030-05-31',
      context: doctorContext(fixture.user.id),
    })) as { bookings: Array<{ id: string; patientName: string }> }
    expect(res.bookings.find((b) => b.id === booking.id)?.patientName).toBeTruthy()
  })

  it('returns 400 for missing dates', async () => {
    const fixture = await createTestAdminDoctor()
    toDeleteDoctors.push(fixture)
    try {
      await bookingsHandler(createApiEvent({
        method: 'GET',
        url: '/api/doctor/bookings',
        context: doctorContext(fixture.user.id),
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expect((e as { statusCode?: number }).statusCode).toBe(400)
    }
  })
})

describe('GET /api/doctor/bookings/:id', () => {
  it('returns 403 for a booking assigned to another doctor', async () => {
    const mine = await createTestAdminDoctor()
    const other = await createTestAdminDoctor()
    toDeleteDoctors.push(mine, other)
    const patient = await createTestUser({ emailVerified: true, email: `dr-x-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const booking = await prisma.booking.create({
      data: {
        userId: patient.id,
        doctorId: other.doctor.id,
        date: new Date('2030-06-10T00:00:00'),
        startTime: '10:00',
        endTime: '11:00',
        service: 'Online Consultation',
        status: 'CONFIRMED',
      },
    })
    toDeleteBookings.push(booking.id)

    try {
      await bookingDetailHandler(createApiEvent({
        method: 'GET',
        url: `/api/doctor/bookings/${booking.id}`,
        context: { ...doctorContext(mine.user.id), params: { id: booking.id } } as never,
      }) as never)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })
})

describe('GET /api/doctor/session/:bookingId', () => {
  it('returns 403 outside the join window', async () => {
    const fixture = await createTestAdminDoctor()
    toDeleteDoctors.push(fixture)
    const patient = await createTestUser({ emailVerified: true, email: `dr-sess-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const booking = await prisma.booking.create({
      data: {
        userId: patient.id,
        doctorId: fixture.doctor.id,
        date: new Date('2030-07-10T00:00:00'),
        startTime: '10:00',
        endTime: '11:00',
        service: 'Online Consultation',
        status: 'CONFIRMED',
      },
    })
    toDeleteBookings.push(booking.id)

    try {
      await sessionHandler(createApiEvent({
        method: 'GET',
        url: `/api/doctor/session/${booking.id}`,
        context: { ...doctorContext(fixture.user.id), params: { bookingId: booking.id } } as never,
      }) as never)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Session is not available')
    }
  })
})
