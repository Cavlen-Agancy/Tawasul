import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { RoomServiceClient } from 'livekit-server-sdk'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import {
  assertAdmittedParticipantIdentity,
  assertDoctorSessionOwner,
  assertOnlineConfirmedBooking,
  assertSessionWindow,
} from '~/server/utils/session-access'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const bookingId = getRouterParam(event, 'bookingId')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const body = await readBody<{ identity?: unknown }>(event).catch(() => undefined)
  const identity = typeof body?.identity === 'string' ? body.identity.trim() : ''
  if (!identity) {
    throw createError({ statusCode: 400, message: 'identity is required' })
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: auth.userId },
    include: { user: { select: { isActive: true } } },
  })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      sessionRoom: true,
      user: { select: { id: true, isActive: true } },
    },
  })

  if (!booking || !booking.sessionRoom) {
    throw createError({ statusCode: 404, message: 'Booking or Room not found' })
  }

  assertDoctorSessionOwner(doctor, booking)
  assertOnlineConfirmedBooking(booking)
  if (!booking.user.isActive) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  await assertSessionWindow(booking)

  const roomName = booking.sessionRoom.roomName

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    throw createError({ statusCode: 500, message: 'LiveKit is not configured' })
  }

  const liveKitUrl = process.env.LIVEKIT_INTERNAL_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'http://tawasul_livekit:7880'
      : (process.env.LIVEKIT_URL || 'ws://localhost:7880').replace('ws://', 'http://').replace('wss://', 'https://'))

  const roomService = new RoomServiceClient(liveKitUrl, apiKey, apiSecret)

  const currentEntryId = booking.sessionRoom.currentEntryId
  if (!currentEntryId) {
    await roomService.removeParticipant(roomName, identity).catch(() => undefined)
    throw createError({ statusCode: 403, message: 'Participant does not match the current booking entry' })
  }

  try {
    // The identity must identify the patient's current server-side entry. An
    // old token from a previous admission fails this check; remove it from the
    // room so it cannot linger in the waiting area.
    assertAdmittedParticipantIdentity(booking, identity, currentEntryId)
  } catch (error) {
    await roomService.removeParticipant(roomName, identity).catch(() => undefined)
    throw error
  }

  let participantSid: string
  try {
    const participants = await roomService.listParticipants(roomName)
    const matches = participants.filter((p) => p.identity === identity)
    if (matches.length === 0) {
      throw createError({ statusCode: 409, message: 'Participant is not in the room' })
    }
    if (matches.length > 1) {
      // Duplicate connections cannot be tied to one admitted SID; remove them
      // and require a fresh lobby entry.
      await roomService.removeParticipant(roomName, identity).catch(() => undefined)
      throw createError({ statusCode: 409, message: 'Multiple participant connections; re-enter the lobby' })
    }
    participantSid = matches[0].sid
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[doctor/session/admit] Failed to list room participants:', error)
    throw createError({ statusCode: 502, message: 'Failed to verify participant' })
  }

  // A reconnected old token has the same entry identity but a new LiveKit SID.
  // Once an entry has been admitted, a different SID means it disconnected and
  // must return to the Lobby for a fresh token/admission.
  if (
    booking.sessionRoom.admittedParticipantSid
    && booking.sessionRoom.admittedParticipantSid !== participantSid
  ) {
    await roomService.removeParticipant(roomName, identity).catch(() => undefined)
    throw createError({
      statusCode: 403,
      message: 'Participant must re-enter through the lobby for a fresh admission',
    })
  }

  const revokePermission = () => roomService.updateParticipant(roomName, identity, {
    permission: {
      canPublish: false,
      canSubscribe: false,
      canPublishData: false,
      hidden: false,
      recorder: false,
    },
  }).catch(() => undefined)

  try {
    await roomService.updateParticipant(roomName, identity, {
      permission: {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        hidden: false,
        recorder: false,
      },
    })

    // `updateParticipant` targets the current connection for this identity. If
    // the patient reconnected with the old token between the SID check and the
    // grant, the grant landed on the new SID. Verify before persisting; revoke
    // and require a fresh lobby entry if the connection changed.
    const afterGrant = await roomService.listParticipants(roomName)
    const currentMatches = afterGrant.filter((p) => p.identity === identity)
    if (currentMatches.length !== 1 || currentMatches[0].sid !== participantSid) {
      throw createError({
        statusCode: 409,
        message: 'Participant connection changed; re-enter the lobby',
      })
    }
  } catch (error) {
    // Revoke on every post-grant failure; a failed verification must not leave
    // media permissions behind.
    await revokePermission()
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[doctor/session/admit] Failed to admit participant:', error)
    throw createError({ statusCode: 502, message: 'Failed to admit participant' })
  }

  try {
    // Conditional persist closes the race where a patient obtains a new lobby
    // entry between the checks above and this write. If the entry or admitted
    // SID changed, this admission is stale and must not be recorded.
    const persisted = await prisma.sessionRoom.updateMany({
      where: {
        bookingId,
        roomName,
        currentEntryId,
        OR: [
          { admittedParticipantSid: null },
          { admittedParticipantSid: participantSid },
        ],
      },
      data: { admittedParticipantSid: participantSid },
    })

    if (persisted.count === 0) {
      await revokePermission()
      throw createError({
        statusCode: 409,
        message: 'Session entry changed; re-enter the lobby',
      })
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[doctor/session/admit] Failed to persist admission state:', error)
    await revokePermission()
    throw createError({ statusCode: 500, message: 'Failed to persist admission state' })
  }

  return { success: true }
})
