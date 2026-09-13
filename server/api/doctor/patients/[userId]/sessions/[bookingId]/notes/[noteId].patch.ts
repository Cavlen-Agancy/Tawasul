import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
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

  const body = await readBody<{ content?: unknown }>(event).catch(() => undefined)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content) {
    throw createError({ statusCode: 400, message: 'Note content is required' })
  }
  if (content.length > 2000) {
    throw createError({ statusCode: 400, message: 'Note content must be 2000 characters or less' })
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

  // Own notes only: peer notes are read-only.
  if (note.doctorId !== doctor.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const updated = await prisma.doctorNote.update({
    where: { id: noteId },
    data: { content },
  })

  return { note: updated }
})
