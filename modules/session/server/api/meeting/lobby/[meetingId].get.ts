import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth, type AuthUser } from '~/server/utils/auth'
import { canJoinMeetingAt } from '~/server/utils/meeting'

export type MeetingRole = 'patient' | 'doctor' | 'staff'

/**
 * Resolves which role (if any) the given auth user holds for a booking.
 * Patients own the booking; doctors are matched via their Doctor record;
 * staff may join any confirmed meeting.
 */
export async function meetingRoleFor(auth: AuthUser, booking: {
  userId: string
  doctorId: string | null
}): Promise<MeetingRole | null> {
  if (booking.userId === auth.userId) return 'patient'
  if (auth.accountType === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId: auth.userId }, select: { id: true } })
    if (doctor && doctor.id === booking.doctorId) return 'doctor'
  }
  if (auth.accountType === 'STAFF') return 'staff'
  return null
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const meetingId = getRouterParam(event, 'meetingId')
  if (!meetingId) {
    throw createError({ statusCode: 400, message: 'Meeting ID is required' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: meetingId },
    include: {
      user: { select: { name: true } },
      doctor: { include: { user: { select: { name: true } } } },
      sessionRoom: true,
    },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Meeting not found' })
  }

  const role = await meetingRoleFor(auth, booking)
  if (!role) {
    throw createError({ statusCode: 403, message: 'You are not part of this meeting' })
  }

  const now = Date.now()
  const canJoin = booking.status === 'CONFIRMED' && canJoinMeetingAt(booking, now)

  return {
    meetingId: booking.id,
    role,
    status: booking.status,
    canJoin,
    patientName: booking.user.name,
    doctorName: booking.doctor?.user?.name ?? '',
    date: formatDateLocal(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
    service: booking.service,
    jitsiDomain: booking.sessionRoom?.roomName ? undefined : (await getJitsiDomain()),
    roomName: booking.sessionRoom?.roomName,
  }
})

function formatDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function getJitsiDomain(): Promise<string> {
  const setting = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  return (setting?.jitsiDomain ?? process.env.JITSI_DOMAIN) || 'meet.jit.si'
}