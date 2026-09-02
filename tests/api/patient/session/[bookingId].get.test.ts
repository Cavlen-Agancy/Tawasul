import { describe, expect, it } from 'vitest'
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

interface RoomResponse {
  roomName: string
  jitsiDomain: string
}

describe('GET /api/patient/session/:bookingId', () => {
  it('returns a room within the time window', async () => {
    const patient = await createPatient({ email: `sess-ok-${Date.now()}@test.com` })
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
          user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' },
        },
      })
      const res = await handler(event) as RoomResponse
      expect(res.roomName).toBe(`tawasul-${fixture.bookingId}`)
      expect(res.jitsiDomain).toBeTruthy()

      const room = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      expect(room?.roomName).toBe(`tawasul-${fixture.bookingId}`)
    } finally {
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
