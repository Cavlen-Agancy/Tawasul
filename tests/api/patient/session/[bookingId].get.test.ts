import { describe, expect, it, vi, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'
import handler from '~/modules/patient/server/api/patient/session/[bookingId].get'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../../helpers'
import { createPatient, createBookedFixture, deletePatientBookingFixture, deletePatient } from '../helpers'
import { prisma } from '~/server/utils/prisma'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function fmt(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function today(): Date {
  return new Date()
}

// Pin "now" to 13:00 today so in-window fixtures never straddle midnight
// (a limitation of the start/end string + single-date booking model).
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

function decodeToken(token: string): {
  exp?: number
  nbf?: number
  iat?: number
  sub?: string
  video?: Record<string, unknown>
} {
  return jwt.decode(token) as {
    exp?: number
    nbf?: number
    iat?: number
    sub?: string
    video?: Record<string, unknown>
  }
}

describe('GET /api/patient/session/:bookingId', () => {
  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('returns a room within the time window', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `sess-ok-${Date.now()}@test.com` })
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
        url: `/api/patient/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
        },
      })
      const res = await handler(event) as RoomResponse
      expect(res.roomName).toBe(`tawasul-${fixture.bookingId}`)
      expect(res.liveKitToken).toBeTruthy()
      expect(res.expiresAt).toBeTruthy()

      const room = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      expect(room?.roomName).toBe(`tawasul-${fixture.bookingId}`)
      expect(room?.expiresAt.toISOString()).toBe(res.expiresAt)
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('returns a fresh member token on every entry and keeps the same room', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `sess-reentry-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(mockedNow + 5 * 60 * 1000) // 5 minutes remaining at "now"
    const noon = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: noon,
      startTime: fmt(start),
      endTime: fmt(end),
    })

    const event = () => createApiEvent({
      method: 'GET',
      url: `/api/patient/session/${fixture.bookingId}`,
      context: {
        params: { bookingId: fixture.bookingId },
        user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
      },
    })

    try {
      const first = await handler(event()) as RoomResponse
      const firstRoom = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      const firstEntryId = firstRoom?.currentEntryId
      const firstDecoded = decodeToken(first.liveKitToken)

      await prisma.sessionRoom.update({
        where: { bookingId: fixture.bookingId },
        data: { admittedParticipantSid: 'sid-admitted-before-reentry' },
      })

      const second = await handler(event()) as RoomResponse
      const secondRoom = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      const secondDecoded = decodeToken(second.liveKitToken)

      expect(first.roomName).toBe(second.roomName)
      expect(first.liveKitToken).toBeTruthy()
      expect(second.liveKitToken).toBeTruthy()
      expect(first.expiresAt).toBe(second.expiresAt)
      expect(firstEntryId).toBeTruthy()
      expect(secondRoom?.currentEntryId).toBeTruthy()
      expect(secondRoom?.currentEntryId).not.toBe(firstEntryId)
      expect(secondRoom?.admittedParticipantSid).toBeNull()
      expect(firstDecoded.sub).not.toBe(secondDecoded.sub)

      expect(secondDecoded.video?.canPublish).toBe(false)
      expect(secondDecoded.video?.canSubscribe).toBe(false)
      // LiveKit tokens use nbf as issuance; iat is not guaranteed to be present.
      // The remaining window at this fixed instant is exactly 300 seconds.
      expect((secondDecoded.exp ?? 0) - (secondDecoded.nbf ?? 0)).toBe(300)
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects access before the permitted window', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `sess-early-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 30 * 60 * 1000)
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
        url: `/api/patient/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Session is not available at this time')
      }
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects access exactly at the appointment end', async () => {
    useFixedNow()
    const patient = await createPatient({ email: `sess-end-${Date.now()}@test.com` })
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
        url: `/api/patient/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
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

  it('rejects access after the appointment end', async () => {
    const now = useFixedNow()
    vi.spyOn(Date, 'now').mockReturnValue(now + 60 * 1000)
    const patient = await createPatient({ email: `sess-after-${Date.now()}@test.com` })
    const local = new Date()
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate())),
      startTime: '12:00',
      endTime: '13:00',
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/patient/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
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

  it('rejects a booking outside the time window', async () => {
    const patient = await createPatient({ email: `sess-far-${Date.now()}@test.com` })
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      startTime: '09:00',
      endTime: '10:00',
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/patient/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Session is not available at this time')
      }
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects another user’s booking', async () => {
    const owner = await createPatient({ email: `sess-owner-${Date.now()}@test.com` })
    const other = await createPatient({ email: `sess-other-${Date.now()}@test.com` })
    const start = new Date(Date.now() + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(owner, {
      status: 'CONFIRMED',
      date: today(),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/patient/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: other.id, email: other.email, accountType: 'PATIENT' },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Forbidden')
      }
    } finally {
      await deletePatientBookingFixture(fixture, owner)
      await deletePatient(other)
    }
  })

  it('rejects staff users', async () => {
    const patient = await createPatient({ email: `sess-staff-owner-${Date.now()}@test.com` })
    const staff = await createTestUser({
      accountType: 'STAFF',
      emailVerified: true,
      email: `sess-staff-${Date.now()}@test.com`,
    })
    const start = new Date(Date.now() + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: today(),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/patient/session/${fixture.bookingId}`,
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

  it('does not let development/test mode bypass ownership or the exact end', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    const originalTestMode = process.env.NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE
    process.env.NODE_ENV = 'development'
    process.env.NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE = 'true'

    const mockedNow = useFixedNow()
    const owner = await createPatient({ email: `sess-mode-owner-${Date.now()}@test.com` })
    const other = await createPatient({ email: `sess-mode-other-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const inWindow = await createBookedFixture(owner, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const now = new Date()
    const ended = await createBookedFixture(owner, {
      status: 'CONFIRMED',
      date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
      startTime: '12:00',
      endTime: '13:00',
    })

    try {
      try {
        await handler(createApiEvent({
          method: 'GET',
          url: `/api/patient/session/${inWindow.bookingId}`,
          context: {
            params: { bookingId: inWindow.bookingId },
            user: { userId: other.id, email: other.email, accountType: 'PATIENT' },
          },
        }))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Forbidden')
      }

      try {
        await handler(createApiEvent({
          method: 'GET',
          url: `/api/patient/session/${ended.bookingId}`,
          context: {
            params: { bookingId: ended.bookingId },
            user: { userId: owner.id, email: owner.email, accountType: 'PATIENT' },
          },
        }))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Session has ended')
      }
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = originalNodeEnv
      if (originalTestMode === undefined) delete process.env.NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE
      else process.env.NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE = originalTestMode
      vi.restoreAllMocks()
      await deletePatientBookingFixture(inWindow, owner)
      await deletePatientBookingFixture(ended, owner)
      await deletePatient(other)
    }
  })

  it('TEST mode bypasses only the clock, not ownership or booking status', async () => {
    useFixedNow()
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { sessionJoinMode: true },
    })
    const previousMode = settings?.sessionJoinMode ?? 'PRODUCTION'
    await prisma.settings.update({
      where: { id: 'singleton' },
      data: { sessionJoinMode: 'TEST' },
    })

    const owner = await createPatient({ email: `sess-test-owner-${Date.now()}@test.com` })
    const other = await createPatient({ email: `sess-test-other-${Date.now()}@test.com` })
    const now = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const ended = await createBookedFixture(owner, {
      status: 'CONFIRMED',
      date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
      startTime: '08:00',
      endTime: '09:00',
    })
    const pending = await createBookedFixture(owner, {
      status: 'PENDING',
      date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
      startTime: '10:00',
      endTime: '11:00',
    })

    try {
      const ownerEvent = createApiEvent({
        method: 'GET',
        url: `/api/patient/session/${ended.bookingId}`,
        context: {
          params: { bookingId: ended.bookingId },
          user: { userId: owner.id, email: owner.email, accountType: 'PATIENT' },
        },
      })
      const res = await handler(ownerEvent) as RoomResponse
      expect(res.roomName).toBe(`tawasul-${ended.bookingId}`)
      expect(res.liveKitToken).toBeTruthy()

      try {
        await handler(createApiEvent({
          method: 'GET',
          url: `/api/patient/session/${ended.bookingId}`,
          context: {
            params: { bookingId: ended.bookingId },
            user: { userId: other.id, email: other.email, accountType: 'PATIENT' },
          },
        }))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Forbidden')
      }

      try {
        await handler(createApiEvent({
          method: 'GET',
          url: `/api/patient/session/${pending.bookingId}`,
          context: {
            params: { bookingId: pending.bookingId },
            user: { userId: owner.id, email: owner.email, accountType: 'PATIENT' },
          },
        }))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Session is not available')
      }
    } finally {
      await prisma.settings.update({
        where: { id: 'singleton' },
        data: { sessionJoinMode: previousMode },
      }).catch(() => undefined)
      vi.restoreAllMocks()
      await deletePatientBookingFixture(ended, owner)
      await deletePatientBookingFixture(pending, owner)
      await deletePatient(other)
    }
  })

  it('rejects in-clinic bookings', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `sess-clinic-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const noon = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      sessionType: 'IN_CLINIC',
      date: noon,
      startTime: fmt(start),
      endTime: fmt(end),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/patient/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
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
    const patient = await createPatient({ email: `sess-pend-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'PENDING',
      date: today(),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/patient/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
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

  it('rejects a deactivated patient account', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ isActive: false, email: `sess-inactive-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: today(),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/patient/session/${fixture.bookingId}`,
        context: {
          params: { bookingId: fixture.bookingId },
          user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
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

  it('returns 404 for a nonexistent booking', async () => {
    const patient = await createPatient({ email: `sess-nf-${Date.now()}@test.com` })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/session/nonexistent',
        context: {
          params: { bookingId: 'nonexistent' },
          user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
        },
      })
      try {
        await handler(event)
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 404, 'Booking not found')
      }
    } finally {
      await deletePatient(patient)
    }
  })
})
