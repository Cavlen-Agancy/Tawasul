import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import {
  terminateSessionRoom,
  sweepExpiredSessionRooms,
  scheduleActiveSessionRooms,
  stopSessionTerminationSchedulerForTests,
} from '~/server/utils/session-termination'
import { ensureSessionRoom } from '~/server/utils/session-room'
import { prisma } from '~/server/utils/prisma'
import { createPatient, createBookedFixture, deletePatientBookingFixture } from '../patient/helpers'

const mocks = vi.hoisted(() => ({
  deleteRoom: vi.fn(),
}))

vi.mock('livekit-server-sdk', () => ({
  RoomServiceClient: vi.fn().mockImplementation(() => ({
    deleteRoom: mocks.deleteRoom,
  })),
}))

async function createRoomFixture(expiresAt: Date) {
  const patient = await createPatient({ email: `term-${Date.now()}-${Math.random()}@test.com` })
  const fixture = await createBookedFixture(patient, { status: 'CONFIRMED' })
  const room = await prisma.sessionRoom.create({
    data: {
      bookingId: fixture.bookingId,
      roomName: `tawasul-${fixture.bookingId}`,
      expiresAt,
      currentEntryId: `entry-${fixture.bookingId}`,
    },
  })
  return { patient, fixture, room }
}

describe('session termination', () => {
  beforeEach(() => {
    mocks.deleteRoom.mockReset()
    mocks.deleteRoom.mockResolvedValue(undefined)
  })

  afterAll(() => {
    stopSessionTerminationSchedulerForTests()
    vi.restoreAllMocks()
  })

  it('terminates the exact room and records terminatedAt', async () => {
    const { patient, fixture, room } = await createRoomFixture(new Date(Date.now() - 1000))
    try {
      const result = await terminateSessionRoom(fixture.bookingId, room.roomName)
      expect(result).toBe(true)
      expect(mocks.deleteRoom).toHaveBeenCalledTimes(1)
      expect(mocks.deleteRoom).toHaveBeenCalledWith(room.roomName)

      const stored = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      expect(stored?.terminatedAt).toBeTruthy()
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('is idempotent for repeated termination calls', async () => {
    const { patient, fixture, room } = await createRoomFixture(new Date(Date.now() - 1000))
    try {
      await terminateSessionRoom(fixture.bookingId, room.roomName)
      await terminateSessionRoom(fixture.bookingId, room.roomName)
      expect(mocks.deleteRoom).toHaveBeenCalledTimes(1)

      mocks.deleteRoom.mockClear()
      await sweepExpiredSessionRooms()
      expect(mocks.deleteRoom).not.toHaveBeenCalledWith(room.roomName)
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('does not terminate another booking when the room name does not match', async () => {
    const first = await createRoomFixture(new Date(Date.now() - 1000))
    const second = await createRoomFixture(new Date(Date.now() - 1000))
    try {
      const result = await terminateSessionRoom(first.fixture.bookingId, second.room.roomName)
      expect(result).toBe(false)
      expect(mocks.deleteRoom).not.toHaveBeenCalled()

      const secondStored = await prisma.sessionRoom.findUnique({ where: { bookingId: second.fixture.bookingId } })
      expect(secondStored?.terminatedAt).toBeNull()
    } finally {
      await deletePatientBookingFixture(first.fixture, first.patient)
      await deletePatientBookingFixture(second.fixture, second.patient)
    }
  })

  it('sweeps only expired, un-terminated rooms after restart/missed execution', async () => {
    const expired = await createRoomFixture(new Date(Date.now() - 1000))
    const future = await createRoomFixture(new Date(Date.now() + 60 * 60 * 1000))
    try {
      const terminated = await sweepExpiredSessionRooms()
      expect(terminated).toBeGreaterThanOrEqual(1)
      expect(mocks.deleteRoom).toHaveBeenCalledWith(expired.room.roomName)
      expect(mocks.deleteRoom).not.toHaveBeenCalledWith(future.room.roomName)

      const expiredStored = await prisma.sessionRoom.findUnique({ where: { bookingId: expired.fixture.bookingId } })
      const futureStored = await prisma.sessionRoom.findUnique({ where: { bookingId: future.fixture.bookingId } })
      expect(expiredStored?.terminatedAt).toBeTruthy()
      expect(futureStored?.terminatedAt).toBeNull()
    } finally {
      await deletePatientBookingFixture(expired.fixture, expired.patient)
      await deletePatientBookingFixture(future.fixture, future.patient)
    }
  })

  it('re-arms future room timers after an application restart', async () => {
    const future = await createRoomFixture(new Date(Date.now() + 60 * 60 * 1000))
    try {
      const scheduled = await scheduleActiveSessionRooms()
      expect(scheduled).toBeGreaterThanOrEqual(1)
      expect(mocks.deleteRoom).not.toHaveBeenCalled()
      const stored = await prisma.sessionRoom.findUnique({ where: { bookingId: future.fixture.bookingId } })
      expect(stored?.terminatedAt).toBeNull()
    } finally {
      await deletePatientBookingFixture(future.fixture, future.patient)
    }
  })

  it('clears an old termination and re-arms when a reschedule moves the end', async () => {
    const { patient, fixture } = await createRoomFixture(new Date(Date.now() - 60 * 1000))
    await prisma.sessionRoom.update({
      where: { bookingId: fixture.bookingId },
      data: { terminatedAt: new Date(), admittedParticipantSid: 'sid-old' },
    })
    const newExpiry = new Date(Date.now() + 60 * 60 * 1000)

    try {
      const room = await ensureSessionRoom(fixture.bookingId, newExpiry.getTime(), 'entry-rescheduled')
      expect(room.expiresAt.getTime()).toBe(newExpiry.getTime())
      expect(room.terminatedAt).toBeNull()
      expect(room.currentEntryId).toBe('entry-rescheduled')
      expect(room.admittedParticipantSid).toBeNull()
      expect(mocks.deleteRoom).not.toHaveBeenCalled()
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('treats a missing LiveKit room as already terminated', async () => {
    const { patient, fixture, room } = await createRoomFixture(new Date(Date.now() - 1000))
    mocks.deleteRoom.mockRejectedValueOnce({ code: 'not_found', message: 'room not found' })
    try {
      const result = await terminateSessionRoom(fixture.bookingId, room.roomName)
      expect(result).toBe(true)
      const stored = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      expect(stored?.terminatedAt).toBeTruthy()
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('does not record termination when LiveKit fails transiently', async () => {
    const { patient, fixture, room } = await createRoomFixture(new Date(Date.now() - 1000))
    mocks.deleteRoom.mockRejectedValueOnce(new Error('network down'))
    try {
      const result = await terminateSessionRoom(fixture.bookingId, room.roomName)
      expect(result).toBe(false)
      const stored = await prisma.sessionRoom.findUnique({ where: { bookingId: fixture.bookingId } })
      expect(stored?.terminatedAt).toBeNull()
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })
})
