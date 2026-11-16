import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import handler from '~/modules/doctor/server/api/doctor/session/[bookingId]/admit.post'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../../../helpers'
import { createPatient, createBookedFixture, deletePatientBookingFixture, deletePatient } from '../../../patient/helpers'
import { createTestDoctor, deleteTestDoctor } from '../../../booking/helpers'
import { prisma } from '~/server/utils/prisma'

const mocks = vi.hoisted(() => ({
  updateParticipant: vi.fn(),
  listParticipants: vi.fn(),
  removeParticipant: vi.fn(),
  roomServiceClient: vi.fn(),
}))

vi.mock('livekit-server-sdk', () => ({
  RoomServiceClient: mocks.roomServiceClient,
}))

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

/** Restore only the Date.now spy; hoisted LiveKit mocks must survive the test. */
function restoreNowSpy() {
  const now = Date.now as unknown as { mockRestore?: () => void }
  now.mockRestore?.()
}

function doctorUser(doctor: { user: { id: string; email: string } }) {
  return { userId: doctor.user.id, email: doctor.user.email, accountType: 'DOCTOR' }
}

function admitEvent(bookingId: string, user: { userId: string; email: string; accountType: string }, identity: string) {
  return createApiEvent({
    method: 'POST',
    url: `/api/doctor/session/${bookingId}/admit`,
    body: { identity },
    context: {
      params: { bookingId },
      user,
    },
  })
}

async function addSessionRoom(bookingId: string) {
  const entryId = `entry-${bookingId}-${Date.now()}`
  const room = await prisma.sessionRoom.create({
    data: {
      bookingId,
      roomName: `tawasul-${bookingId}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      currentEntryId: entryId,
    },
  })
  return { room, entryId }
}

function participantIdentity(userId: string, entryId: string): string {
  return `${userId}:${entryId}`
}

describe('POST /api/doctor/session/:bookingId/admit', () => {
  beforeEach(() => {
    mocks.updateParticipant.mockReset()
    mocks.updateParticipant.mockResolvedValue(undefined)
    mocks.listParticipants.mockReset()
    mocks.listParticipants.mockResolvedValue([])
    mocks.removeParticipant.mockReset()
    mocks.removeParticipant.mockResolvedValue(undefined)
    mocks.roomServiceClient.mockReset()
    mocks.roomServiceClient.mockImplementation(() => ({
      updateParticipant: mocks.updateParticipant,
      listParticipants: mocks.listParticipants,
      removeParticipant: mocks.removeParticipant,
    }))
  })

  afterAll(() => {
    restoreNowSpy()
  })

  it('admits the booked patient when the assigned doctor requests it', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-ok-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    const { room, entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)
    mocks.listParticipants.mockResolvedValue([{ identity, sid: 'sid-1' }])

    try {
      const res = await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
      expect(res).toEqual({ success: true })
      expect(mocks.updateParticipant).toHaveBeenCalledTimes(1)
      expect(mocks.updateParticipant).toHaveBeenCalledWith(room.roomName, identity, expect.objectContaining({
        permission: expect.objectContaining({
          canPublish: true,
          canSubscribe: true,
        }),
      }))
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects a different patient identity', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-wrong-id-owner-${Date.now()}@test.com` })
    const other = await createPatient({ email: `admit-wrong-id-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { entryId } = await addSessionRoom(fixture.bookingId)
    const otherIdentity = participantIdentity(other.id, entryId)

    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), otherIdentity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Participant does not match the current booking entry')
      }
      expect(mocks.removeParticipant).toHaveBeenCalledTimes(1)
      expect(mocks.updateParticipant).not.toHaveBeenCalled()
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
      await deletePatient(other)
    }
  })

  it('rejects a doctor who does not own the booking', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-wrong-doc-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const otherDoctor = await createTestDoctor({ dayOfWeek: 2, startTime: '09:00', endTime: '18:00' })
    const { entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)

    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(otherDoctor), identity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Forbidden')
      }
      expect(mocks.updateParticipant).not.toHaveBeenCalled()
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
      await deleteTestDoctor(otherDoctor.doctor.id, otherDoctor.user.id)
    }
  })

  it('rejects a staff account', async () => {
    const patient = await createPatient({ email: `admit-staff-owner-${Date.now()}@test.com` })
    const fixture = await createBookedFixture(patient, { status: 'CONFIRMED' })
    const { entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)
    const staff = await createTestUser({
      accountType: 'STAFF',
      emailVerified: true,
      email: `admit-staff-${Date.now()}@test.com`,
    })

    try {
      try {
        await handler(admitEvent(fixture.bookingId, {
          userId: staff.id,
          email: staff.email,
          accountType: 'STAFF',
        }, identity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Forbidden')
      }
      expect(mocks.updateParticipant).not.toHaveBeenCalled()
    } finally {
      await deletePatientBookingFixture(fixture, patient)
      await deleteTestUser(staff.id)
    }
  })

  it('rejects an in-clinic booking', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-clinic-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      sessionType: 'IN_CLINIC',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)

    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 400, 'This is an in-clinic session.')
      }
      expect(mocks.updateParticipant).not.toHaveBeenCalled()
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects a non-confirmed booking', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-pending-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'PENDING',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)

    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Session is not available')
      }
      expect(mocks.updateParticipant).not.toHaveBeenCalled()
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects admission exactly at the appointment end', async () => {
    useFixedNow()
    const patient = await createPatient({ email: `admit-end-${Date.now()}@test.com` })
    const now = new Date()
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
      startTime: '12:00',
      endTime: '13:00',
    })
    const { entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)

    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Session has ended')
      }
      expect(mocks.updateParticipant).not.toHaveBeenCalled()
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects an inactive patient', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ isActive: false, email: `admit-inactive-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)

    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Forbidden')
      }
      expect(mocks.updateParticipant).not.toHaveBeenCalled()
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('is safe to call twice for the same patient', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-duplicate-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)
    mocks.listParticipants.mockResolvedValue([{ identity, sid: 'sid-duplicate' }])

    try {
      await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
      await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
      expect(mocks.updateParticipant).toHaveBeenCalledTimes(2)
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects a reconnected old token (same entry, new SID) and removes it', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-old-token-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)
    mocks.listParticipants.mockResolvedValue([{ identity, sid: 'sid-first' }])

    try {
      await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
      expect(mocks.updateParticipant).toHaveBeenCalledTimes(1)

      // A reconnect with the same token creates a new LiveKit participant SID.
      mocks.listParticipants.mockResolvedValue([{ identity, sid: 'sid-reconnected' }])
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Participant must re-enter through the lobby for a fresh admission')
      }
      expect(mocks.updateParticipant).toHaveBeenCalledTimes(1)
      expect(mocks.removeParticipant).toHaveBeenCalledWith(`tawasul-${fixture.bookingId}`, identity)
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects a stale entry identity and removes that participant', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-stale-entry-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { room, entryId } = await addSessionRoom(fixture.bookingId)
    const staleIdentity = participantIdentity(patient.id, `${entryId}-old`)
    await prisma.sessionRoom.update({
      where: { bookingId: fixture.bookingId },
      data: { currentEntryId: `${entryId}-new`, admittedParticipantSid: null },
    })

    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), staleIdentity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Participant does not match the current booking entry')
      }
      expect(mocks.removeParticipant).toHaveBeenCalledWith(room.roomName, staleIdentity)
      expect(mocks.updateParticipant).not.toHaveBeenCalled()
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('allows the patient after a fresh server-side entry rotation', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-fresh-entry-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { entryId } = await addSessionRoom(fixture.bookingId)
    const firstIdentity = participantIdentity(patient.id, entryId)
    mocks.listParticipants.mockResolvedValue([{ identity: firstIdentity, sid: 'sid-first' }])

    try {
      await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), firstIdentity))

      // Simulate the patient returning through the lobby: the token route
      // rotates currentEntryId and clears the admitted SID.
      const newEntryId = `${entryId}-fresh`
      await prisma.sessionRoom.update({
        where: { bookingId: fixture.bookingId },
        data: { currentEntryId: newEntryId, admittedParticipantSid: null },
      })
      const newIdentity = participantIdentity(patient.id, newEntryId)
      mocks.listParticipants.mockResolvedValue([{ identity: newIdentity, sid: 'sid-fresh' }])

      await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), newIdentity))
      expect(mocks.updateParticipant).toHaveBeenCalledTimes(2)
      const room = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      expect(room?.admittedParticipantSid).toBe('sid-fresh')
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('revokes a grant when the participant reconnects between the SID check and grant', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-grant-race-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { room, entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)
    mocks.listParticipants
      .mockResolvedValueOnce([{ identity, sid: 'sid-before-grant' }])
      .mockResolvedValueOnce([{ identity, sid: 'sid-after-grant' }])

    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 409, 'Participant connection changed; re-enter the lobby')
      }
      expect(mocks.updateParticipant).toHaveBeenCalledTimes(2)
      expect(mocks.updateParticipant).toHaveBeenLastCalledWith(room.roomName, identity, expect.objectContaining({
        permission: expect.objectContaining({
          canPublish: false,
          canSubscribe: false,
        }),
      }))
      const stored = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      expect(stored?.admittedParticipantSid).toBeNull()
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('rejects duplicate connections for the same identity', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-duplicate-conn-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { room, entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)
    mocks.listParticipants.mockResolvedValue([
      { identity, sid: 'sid-a' },
      { identity, sid: 'sid-b' },
    ])

    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 409, 'Multiple participant connections; re-enter the lobby')
      }
      expect(mocks.removeParticipant).toHaveBeenCalledWith(room.roomName, identity)
      expect(mocks.updateParticipant).not.toHaveBeenCalled()
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('does not persist admission when the lobby entry rotates mid-flight', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `admit-race-${Date.now()}@test.com` })
    const start = new Date(mockedNow + 2 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
      startTime: fmt(start),
      endTime: fmt(new Date(start.getTime() + 60 * 60 * 1000)),
    })
    const { room, entryId } = await addSessionRoom(fixture.bookingId)
    const identity = participantIdentity(patient.id, entryId)
    mocks.listParticipants.mockImplementation(async () => {
      // Simulate the patient obtaining a fresh lobby token between validation
      // and the admission write.
      await prisma.sessionRoom.update({
        where: { bookingId: fixture.bookingId },
        data: { currentEntryId: `${entryId}-rotated`, admittedParticipantSid: null },
      })
      return [{ identity, sid: 'sid-race' }]
    })

    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), identity))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 409, 'Session entry changed; re-enter the lobby')
      }
      expect(mocks.updateParticipant).toHaveBeenCalledTimes(2)
      expect(mocks.updateParticipant).toHaveBeenLastCalledWith(room.roomName, identity, expect.objectContaining({
        permission: expect.objectContaining({
          canPublish: false,
          canSubscribe: false,
        }),
      }))
      const stored = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      expect(stored?.admittedParticipantSid).toBeNull()
      expect(stored?.currentEntryId).toBe(`${entryId}-rotated`)
    } finally {
      restoreNowSpy()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('returns 404 when no session room exists', async () => {
    const patient = await createPatient({ email: `admit-noroom-${Date.now()}@test.com` })
    const fixture = await createBookedFixture(patient, { status: 'CONFIRMED' })
    try {
      try {
        await handler(admitEvent(fixture.bookingId, doctorUser(fixture.doctor), patient.id))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 404, 'Booking or Room not found')
      }
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })
})
