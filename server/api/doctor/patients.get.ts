import { defineEventHandler, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { formatDateUTC } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const doctor = await prisma.doctor.findUnique({ where: { userId: auth.userId } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  // Only CONFIRMED bookings establish patient visibility for this doctor.
  const bookings = await prisma.booking.findMany({
    where: { doctorId: doctor.id, status: 'CONFIRMED' },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, photo: true, createdAt: true } },
    },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
  })

  const byPatient = new Map<string, {
    userId: string
    name: string
    email: string
    phone: string | null
    photo: string | null
    createdAt: Date
    totalSessions: number
    lastSession: string
  }>()

  for (const b of bookings) {
    const existing = byPatient.get(b.userId)
    if (existing) {
      existing.totalSessions += 1
    } else {
      byPatient.set(b.userId, {
        userId: b.user.id,
        name: b.user.name,
        email: b.user.email,
        phone: b.user.phone,
        photo: b.user.photo,
        createdAt: b.user.createdAt,
        totalSessions: 1,
        lastSession: formatDateUTC(b.date),
      })
    }
  }

  return { patients: [...byPatient.values()] }
})
