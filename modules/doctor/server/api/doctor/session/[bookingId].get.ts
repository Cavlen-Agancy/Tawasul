import { defineEventHandler, getRouterParam, createError } from 'h3'
import { SESSION_JOIN_TEST_TTL_SECONDS } from '~/lib/session-join'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import {
  assertDoctorSessionOwner,
  assertOnlineConfirmedBooking,
  assertSessionWindow,
  sessionTokenTtlSeconds,
  sessionWindowCloseAt,
} from '~/server/utils/session-access'
import { ensureSessionRoom } from '~/server/utils/session-room'
import { generateLiveKitToken } from '~/server/utils/livekit-token'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const bookingId = getRouterParam(event, 'bookingId')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: auth.userId },
    include: { user: { select: { id: true, name: true, isActive: true } } },
  })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      sessionRoom: true,
      user: { select: { id: true, name: true, isActive: true } },
    },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  assertDoctorSessionOwner(doctor, booking)
  assertOnlineConfirmedBooking(booking)
  if (!booking.user.isActive) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  const mode = await assertSessionWindow(booking)

  const now = Date.now()
  const ttlSeconds = sessionTokenTtlSeconds(booking, now, mode)
  const appointmentEnd = sessionWindowCloseAt(booking)
  // TEST mode keeps the room available for the token lifetime; PRODUCTION
  // still terminates the room at the exact appointment end.
  const closeAt = mode === 'TEST'
    ? Math.max(appointmentEnd, now + SESSION_JOIN_TEST_TTL_SECONDS * 1000)
    : appointmentEnd
  const room = await ensureSessionRoom(bookingId, closeAt)

  const liveKitToken = await generateLiveKitToken({
    roomName: room.roomName,
    userName: doctor.user.name,
    userId: doctor.user.id,
    role: 'moderator',
    ttlSeconds,
  })

  return {
    roomName: room.roomName,
    liveKitToken,
    expiresAt: new Date(closeAt).toISOString(),
    sessionInfo: {
      doctorName: doctor.user.name,
      patientName: booking.user.name,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      service: booking.service || 'Online Consultation',
    },
  }
})
