import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { doctorBookingsQuerySchema, validationMessage } from '~/server/utils/validation'
import { parseDateUTC, formatDateUTC } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const parsed = doctorBookingsQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }
  const { start, end } = parsed.data

  const doctor = await prisma.doctor.findUnique({ where: { userId: auth.userId } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  const bookings = await prisma.booking.findMany({
    where: {
      doctorId: doctor.id,
      date: {
        gte: parseDateUTC(start),
        lte: parseDateUTC(end),
      },
    },
    include: {
      user: { select: { name: true, photo: true } },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })

  return {
    bookings: bookings.map((b) => ({
      id: b.id,
      patientName: b.user.name,
      patientPhoto: b.user.photo,
      date: formatDateUTC(b.date),
      startTime: b.startTime,
      endTime: b.endTime,
      service: b.service,
      status: b.status,
    })),
  }
})
