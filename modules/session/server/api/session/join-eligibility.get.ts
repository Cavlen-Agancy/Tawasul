import { defineEventHandler } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { getSessionJoinMode } from '~/server/utils/session-join-mode'
import { canJoinSessionAt, joinWindowMessage } from '~/lib/session-join'

/**
 * Server-computed join eligibility for the caller's own confirmed online
 * bookings. This lets the patient/doctor Join buttons mirror the token
 * endpoint without exposing the administrative mode setting itself.
 */
export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT', 'DOCTOR'])

  const select = { id: true, date: true, startTime: true, endTime: true } as const
  let bookings: Array<{ id: string; date: Date; startTime: string; endTime: string }> = []

  if (auth.accountType === 'PATIENT') {
    bookings = await prisma.booking.findMany({
      where: { userId: auth.userId, status: 'CONFIRMED', sessionType: 'ONLINE' },
      select,
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      take: 100,
    })
  } else {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    })
    if (doctor) {
      bookings = await prisma.booking.findMany({
        where: { doctorId: doctor.id, status: 'CONFIRMED', sessionType: 'ONLINE' },
        select,
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: 200,
      })
    }
  }

  const mode = await getSessionJoinMode()
  const now = Date.now()

  return {
    eligibility: bookings.map((booking) => {
      const canJoin = canJoinSessionAt(booking, now, mode)
      return {
        bookingId: booking.id,
        canJoin,
        ...(canJoin ? {} : { reason: joinWindowMessage(booking, now) }),
      }
    }),
  }
})
