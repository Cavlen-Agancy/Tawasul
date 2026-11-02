import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { RoomServiceClient } from 'livekit-server-sdk'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const bookingId = getRouterParam(event, 'bookingId')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const { identity } = await readBody(event)
  if (!identity) {
    throw createError({ statusCode: 400, message: 'identity is required' })
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: auth.userId } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { sessionRoom: true },
  })

  if (!booking || !booking.sessionRoom) {
    throw createError({ statusCode: 404, message: 'Booking or Room not found' })
  }

  if (booking.doctorId !== doctor.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const roomName = booking.sessionRoom.roomName

  const apiKey = process.env.LIVEKIT_API_KEY!
  const apiSecret = process.env.LIVEKIT_API_SECRET!
  const liveKitUrl = process.env.LIVEKIT_INTERNAL_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'http://tawasul_livekit:7880'
      : (process.env.LIVEKIT_URL || 'ws://localhost:7880').replace('ws://', 'http://').replace('wss://', 'https://'))

  const roomService = new RoomServiceClient(liveKitUrl, apiKey, apiSecret)

  try {
    await roomService.updateParticipant(roomName, identity, {
      permission: {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        hidden: false,
        recorder: false,
      }
    })
  } catch (e) {
    throw createError({ statusCode: 502, message: 'Failed to admit participant' })
  }

  return { success: true }
})
