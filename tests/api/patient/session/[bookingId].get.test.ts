import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import handler from '~/modules/patient/server/api/patient/session/[bookingId].get'
import { createApiEvent, expectApiError } from '../../helpers'
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
}

describe('GET /api/patient/session/:bookingId', () => {
  const originalTestMode = process.env.NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE
  
  beforeAll(() => {
    process.env.NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE = 'false'
  })

  afterAll(() => {
    process.env.NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE = originalTestMode
  })
  it('returns a room within the time window', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `sess-ok-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    // Local noon truncates to the intended calendar day in any DB session
    // timezone (a 00:xx local datetime can land on the previous UTC date).
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

      const room = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      expect(room?.roomName).toBe(`tawasul-${fixture.bookingId}`)
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

  it('rejects another users booking', async () => {
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

  it('rejects a non-confirmed booking', async () => {
    const patient = await createPatient({ email: `sess-pend-${Date.now()}@test.com` })
    const start = new Date(Date.now() + 2 * 60 * 1000)
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
        expectApiError(e, 403, 'Forbidden')
      }
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })
})
