import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { sendEmail, bookingCancellationTemplate } from '~/server/utils/email'
import { formatDateISO } from '~/server/utils/admin-availability'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'APPOINTMENTS', 'DELETE')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      doctor: { include: { user: { select: { name: true } } } },
      payment: true,
    },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  if (booking.status === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Booking is already cancelled' })
  }

  await prisma.$transaction([
    prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } }),
    prisma.payment.updateMany({
      where: { bookingId: id, status: { not: 'REFUNDED' } },
      data: { status: 'REFUNDED' },
    }),
  ])

  try {
    await sendEmail({
      to: booking.user.email,
      subject: 'Your Tawasul Academy session has been cancelled',
      html: bookingCancellationTemplate(
        booking.user.name,
        booking.doctor?.user?.name ?? '',
        formatDateISO(booking.date),
        `${booking.startTime} – ${booking.endTime}`,
      ),
    })
  } catch (error) {
    console.error('[admin] Booking cancellation email could not be sent:', error)
  }

  return { message: 'Booking cancelled successfully' }
})
