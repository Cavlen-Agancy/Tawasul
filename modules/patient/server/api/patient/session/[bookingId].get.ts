import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { canJoinMeetingAt, meetingWindow } from '~/server/utils/meeting'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const bookingId = getRouterParam(event, 'bookingId')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { sessionRoom: true },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  if (booking.userId !== auth.userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  if (booking.status !== 'CONFIRMED') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const now = Date.now()
  if (!canJoinMeetingAt(booking, now)) {
    throw createError({ statusCode: 403, message: 'Session is not available at this time' })
  }

  const jitsiDomain = (await getJitsiDomain()) || 'meet.jit.si'

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

  return { roomName: room.roomName, jitsiDomain }
})

async function getJitsiDomain(): Promise<string> {
  const setting = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  return (setting?.jitsiDomain ?? process.env.JITSI_DOMAIN) || 'meet.jit.si'
}
