import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const userId = getRouterParam(event, 'userId')
  const bookingId = getRouterParam(event, 'bookingId')
  if (!userId || !bookingId) {
    throw createError({ statusCode: 400, message: 'Patient ID and booking ID are required' })
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

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, userId: true, doctorId: true } })
  if (!booking || booking.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  // Own session only: a doctor notes only sessions assigned to them.
  if (booking.doctorId !== doctor.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  // One note per doctor per session (@@unique([bookingId, doctorId])).
  const note = await prisma.doctorNote.upsert({
    where: { bookingId_doctorId: { bookingId, doctorId: doctor.id } },
    create: { bookingId, doctorId: doctor.id, content },
    update: { content },
  })

  return { note }
})
