import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { formatDateUTC } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: auth.userId } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      payment: true,
    },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  if (booking.doctorId !== doctor.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  return {
    id: booking.id,
    patientName: booking.user.name,
    patientEmail: booking.user.email,
    date: formatDateUTC(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
    service: booking.service,
    status: booking.status,
    paymentStatus: booking.payment?.status ?? null,
  }
})
