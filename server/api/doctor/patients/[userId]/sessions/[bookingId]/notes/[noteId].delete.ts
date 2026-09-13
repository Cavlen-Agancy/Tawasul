import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const userId = getRouterParam(event, 'userId')
  const bookingId = getRouterParam(event, 'bookingId')
  const noteId = getRouterParam(event, 'noteId')
  if (!userId || !bookingId || !noteId) {
    throw createError({ statusCode: 400, message: 'Patient ID, booking ID and note ID are required' })
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: auth.userId } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  const note = await prisma.doctorNote.findUnique({
    where: { id: noteId },
    include: { booking: { select: { id: true, userId: true } } },
  })
  if (!note || note.bookingId !== bookingId || note.booking.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  // Own notes only: peer notes cannot be deleted.
  if (note.doctorId !== doctor.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  await prisma.doctorNote.delete({ where: { id: noteId } })

  return { deleted: true }
})
