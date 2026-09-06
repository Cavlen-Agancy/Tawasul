import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { formatDateISO } from '~/server/utils/admin-availability'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'APPOINTMENTS', 'READ')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      doctor: { include: { user: { select: { name: true, email: true } } } },
      payment: true,
    },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  return {
    id: booking.id,
    patientName: booking.user.name,
    patientEmail: booking.user.email,
    patientPhone: booking.user.phone,
    doctorId: booking.doctorId,
    doctorName: booking.doctor?.user.name ?? null,
    doctorEmail: booking.doctor?.user.email ?? null,
    date: formatDateISO(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
    service: booking.service,
    status: booking.status,
    notes: booking.notes,
    paymentStatus: booking.payment?.status ?? null,
    amount: booking.payment ? Number(booking.payment.amount) : null,
    currency: booking.payment?.currency ?? null,
    createdAt: booking.createdAt,
  }
})
