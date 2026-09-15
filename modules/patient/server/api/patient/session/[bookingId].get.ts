import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { canJoinMeetingAt, meetingWindow } from '~/server/utils/meeting'
import { generateLiveKitToken } from '~/server/utils/livekit-token'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const bookingId = getRouterParam(event, 'bookingId')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { sessionRoom: true, user: true },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  if (booking.userId !== auth.userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  
  const sessionTestMode = process.env.NODE_ENV === 'development' && process.env.NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE === 'true'

  if (!sessionTestMode && booking.status !== 'CONFIRMED') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  if (booking.sessionType === 'IN_CLINIC') {
    throw createError({ statusCode: 400, message: 'This is an in-clinic session.' })
  }

  const now = Date.now()
  if (!sessionTestMode && !canJoinMeetingAt(booking, now)) {
    throw createError({ statusCode: 403, message: 'Session is not available at this time' })
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
    userName: booking.user.name,
    userId: booking.user.id,
    role: 'member',
  })

  return { roomName: room.roomName, liveKitToken }
})
