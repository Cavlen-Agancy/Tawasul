import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const userId = getRouterParam(event, 'userId')
  const bookingId = getRouterParam(event, 'bookingId')
  if (!userId || !bookingId) {
    throw createError({ statusCode: 400, message: 'Patient ID and booking ID are required' })
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: auth.userId } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, userId: true } })
  if (!booking || booking.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  // Visibility guard: at least one CONFIRMED booking between this doctor and patient.
  const access = await prisma.booking.findFirst({
    where: { doctorId: doctor.id, userId, status: 'CONFIRMED' },
    select: { id: true },
  })
  if (!access) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const notes = await prisma.doctorNote.findMany({
    where: { bookingId },
    include: {
      doctor: { select: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return {
    notes: notes.map((n) => ({
      id: n.id,
      content: n.content,
      doctorId: n.doctorId,
      doctorName: n.doctor.user.name,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      isOwn: n.doctorId === doctor.id,
    })),
  }
})
