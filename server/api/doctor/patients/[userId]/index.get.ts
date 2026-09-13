import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { formatDateUTC } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Patient ID is required' })
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: auth.userId } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  // Visibility guard: at least one CONFIRMED booking between this doctor and patient.
  const access = await prisma.booking.findFirst({
    where: { doctorId: doctor.id, userId, status: 'CONFIRMED' },
    select: { id: true },
  })
  if (!access) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const patient = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, photo: true },
  })
  if (!patient) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const sessions = await prisma.booking.findMany({
    where: { doctorId: doctor.id, userId },
    include: {
      doctorNotes: { where: { doctorId: doctor.id }, select: { id: true, content: true, updatedAt: true } },
    },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
  })

  return {
    user: patient,
    sessions: sessions.map((s) => ({
      bookingId: s.id,
      date: formatDateUTC(s.date),
      startTime: s.startTime,
      endTime: s.endTime,
      service: s.service,
      sessionType: s.sessionType,
      status: s.status,
      note: s.doctorNotes[0] ?? null,
    })),
  }
})
