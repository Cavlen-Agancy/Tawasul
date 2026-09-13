import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

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

  // Peer authors: other doctors with a CONFIRMED booking with the same patient.
  const peerBookings = await prisma.booking.findMany({
    where: { userId, status: 'CONFIRMED', doctorId: { not: doctor.id } },
    select: { doctorId: true },
  })
  const visibleAuthorIds = new Set<string>([doctor.id])
  for (const b of peerBookings) {
    if (b.doctorId) visibleAuthorIds.add(b.doctorId)
  }

  const notes = await prisma.doctorNote.findMany({
    where: {
      booking: { userId },
      doctorId: { in: [...visibleAuthorIds] },
    },
    include: {
      doctor: { select: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    notes: notes.map((n) => ({
      id: n.id,
      content: n.content,
      bookingId: n.bookingId,
      doctorId: n.doctorId,
      doctorName: n.doctor.user.name,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      isOwn: n.doctorId === doctor.id,
    })),
  }
})
