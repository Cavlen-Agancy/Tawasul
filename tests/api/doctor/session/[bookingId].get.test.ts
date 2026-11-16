import { describe, expect, it, vi, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'
import handler from '~/modules/doctor/server/api/doctor/session/[bookingId].get'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../../helpers'
import { createPatient, createBookedFixture, deletePatientBookingFixture } from '../../patient/helpers'
import { createTestDoctor, deleteTestDoctor } from '../../booking/helpers'
import { prisma } from '~/server/utils/prisma'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function fmt(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function useFixedNow() {
  const d = new Date()
  const now = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 13, 0, 0, 0).getTime()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  return now
}

interface RoomResponse {
  roomName: string
  liveKitToken: string
  expiresAt: string
}

function decodeToken(token: string): { video?: Record<string, unknown> } {
  return jwt.decode(token) as { video?: Record<string, unknown> }
}

describe('GET /api/doctor/session/:bookingId', () => {
  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('returns a moderator room for the assigned doctor in-window', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `doc-sess-ok-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const noon = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: noon,
      startTime: fmt(start),
      endTime: fmt(end),
    })

    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/doctor/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: {
            userId: fixture.doctor.user.id,
            email: fixture.doctor.user.email,
            accountType: 'DOCTOR',
          },
        },
      })

      const res = await handler(event) as RoomResponse
      expect(res.roomName).toBe(`tawasul-${fixture.bookingId}`)
      expect(res.liveKitToken).toBeTruthy()
      expect(res.expiresAt).toBeTruthy()
      expect(decodeToken(res.liveKitToken).video?.canPublish).toBe(true)
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects another doctor', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `doc-sess-wrongdoc-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    const other = await createTestDoctor({
      dayOfWeek: 2,
      startTime: '09:00',
      endTime: '18:00',
    })

    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/doctor/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: other.user.id, email: other.user.email, accountType: 'DOCTOR' },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Forbidden')
      }
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
      await deleteTestDoctor(other.doctor.id, other.user.id)
    }
  })

  it('rejects a staff account', async () => {
    const patient = await createPatient({ email: `doc-sess-staff-${Date.now()}@test.com` })
    const fixture = await createBookedFixture(patient, { status: 'CONFIRMED' })
    const staff = await createTestUser({
      accountType: 'STAFF',
      emailVerified: true,
      email: `doc-sess-staff-user-${Date.now()}@test.com`,
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/doctor/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: staff.id, email: staff.email, accountType: 'STAFF' },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Forbidden')
      }
    } finally {
      await deletePatientBookingFixture(fixture, patient)
      await deleteTestUser(staff.id)
    }
  })

  it('rejects an in-clinic booking', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `doc-sess-clinic-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      sessionType: 'IN_CLINIC',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/doctor/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: {
            userId: fixture.doctor.user.id,
            email: fixture.doctor.user.email,
            accountType: 'DOCTOR',
          },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 400, 'This is an in-clinic session.')
      }
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects a non-confirmed booking', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `doc-sess-pending-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'PENDING',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/doctor/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: {
            userId: fixture.doctor.user.id,
            email: fixture.doctor.user.email,
            accountType: 'DOCTOR',
          },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Session is not available')
      }
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects access exactly at the appointment end', async () => {
    useFixedNow()
    const patient = await createPatient({ email: `doc-sess-end-${Date.now()}@test.com` })
    const now = new Date()
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
      startTime: '12:00',
      endTime: '13:00',
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/doctor/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: {
            userId: fixture.doctor.user.id,
            email: fixture.doctor.user.email,
            accountType: 'DOCTOR',
          },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Session has ended')
      }
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects an inactive doctor', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `doc-sess-inactive-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    await prisma.doctor.update({ where: { id: fixture.doctor.doctor.id }, data: { isActive: false } })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/doctor/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: {
            userId: fixture.doctor.user.id,
            email: fixture.doctor.user.email,
            accountType: 'DOCTOR',
          },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Forbidden')
      }
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects an inactive patient', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ isActive: false, email: `doc-sess-inactive-patient-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/doctor/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: {
            userId: fixture.doctor.user.id,
            email: fixture.doctor.user.email,
            accountType: 'DOCTOR',
          },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Forbidden')
      }
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })
})
