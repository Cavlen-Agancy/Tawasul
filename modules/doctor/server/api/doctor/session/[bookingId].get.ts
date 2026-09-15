import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { canJoinMeetingAt, meetingWindow } from '~/server/utils/meeting'
import { generateLiveKitToken } from '~/server/utils/livekit-token'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const bookingId = getRouterParam(event, 'bookingId')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: auth.userId },
    include: { user: true },
  })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { sessionRoom: true },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  if (booking.doctorId !== doctor.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  
  const sessionTestMode = process.env.NODE_ENV === 'development' && process.env.NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE === 'true'

  if (!sessionTestMode && booking.status !== 'CONFIRMED') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const now = Date.now()
  if (!sessionTestMode && !canJoinMeetingAt(booking, now)) {
    throw createError({ statusCode: 403, message: 'Session is not available' })
  }
  let room = booking.sessionRoom
  if (!room) {
    const { closeAt } = meetingWindow(booking)
    const expiresAt = new Date(closeAt)
    const roomName = `tawasul-${bookingId}`
    room = await prisma.sessionRoom.upsert({
      where: { bookingId },
      create: { bookingId, roomName, expiresAt },
      update: {},
    })
  }

  const liveKitToken = await generateLiveKitToken({
    roomName: room.roomName,
    userName: doctor.user.name,
    userId: doctor.user.id,
    role: 'moderator',
  })

  return { roomName: room.roomName, liveKitToken }
})
