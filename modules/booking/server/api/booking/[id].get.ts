import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { requirePermission } from '~/server/utils/permissions'
import { formatDateISO } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const isStaff = auth.accountType === 'STAFF'
  if (isStaff) {
    await requirePermission(event, 'APPOINTMENTS', 'READ')
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      doctor: { include: { user: { select: { name: true } } } },
      payment: true,
    },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  if (!isStaff && booking.userId !== auth.userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  return {
    id: booking.id,
    patientName: booking.user.name,
    doctorName: booking.doctor.user.name,
    date: formatDateISO(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
    service: booking.service,
    status: booking.status,
    paymentStatus: booking.payment?.status ?? 'PENDING',
    amount: Number(booking.payment?.amount ?? 0),
    currency: booking.payment?.currency ?? 'EGP',
  }
})
