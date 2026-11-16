import { randomUUID } from 'node:crypto'
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { SESSION_JOIN_TEST_TTL_SECONDS } from '~/lib/session-join'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import {
  assertOnlineConfirmedBooking,
  assertPatientSessionOwner,
  assertSessionWindow,
  buildSessionParticipantIdentity,
  sessionTokenTtlSeconds,
  sessionWindowCloseAt,
} from '~/server/utils/session-access'
import { ensureSessionRoom } from '~/server/utils/session-room'
import { generateLiveKitToken } from '~/server/utils/livekit-token'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const bookingId = getRouterParam(event, 'bookingId')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      sessionRoom: true,
      user: true,
      doctor: {
        include: {
          user: true,
        },
      },
    },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  // Authorization failures intentionally occur before status/window details are
  // exposed, to avoid leaking another patient's booking/session state.
  assertPatientSessionOwner(auth, booking, booking.user.isActive)
  assertOnlineConfirmedBooking(booking)
  const mode = await assertSessionWindow(booking)

  const now = Date.now()
  const ttlSeconds = sessionTokenTtlSeconds(booking, now, mode)
  const appointmentEnd = sessionWindowCloseAt(booking)
  // TEST mode keeps the room alive for the token lifetime so "any time" joins
  // also work after the scheduled end. PRODUCTION retains exact-end termination.
  const closeAt = mode === 'TEST'
    ? Math.max(appointmentEnd, now + SESSION_JOIN_TEST_TTL_SECONDS * 1000)
    : appointmentEnd
  // Every fresh lobby entry gets a new server-side generation. Old tokens
  // remain connected to the previous generation and cannot be admitted again.
  const entryId = randomUUID()
  const room = await ensureSessionRoom(bookingId, closeAt, entryId)

  const liveKitToken = await generateLiveKitToken({
    roomName: room.roomName,
    userName: booking.user.name,
    userId: buildSessionParticipantIdentity(booking.user.id, entryId),
    role: 'member',
    ttlSeconds,
  })

  return {
    roomName: room.roomName,
    liveKitToken,
    expiresAt: new Date(closeAt).toISOString(),
    sessionInfo: {
      doctorName: booking.doctor?.user?.name || 'Healthcare Provider',
      patientName: booking.user.name,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      service: booking.service || 'Online Consultation',
    },
  }
})
