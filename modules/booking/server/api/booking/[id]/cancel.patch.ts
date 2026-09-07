import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { requirePermission } from '~/server/utils/permissions'
import { parseISODate } from '~/server/utils/availability'
import { sendEmail, bookingCancellationTemplate } from '~/server/utils/email'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const isStaff = auth.accountType === 'STAFF'
  if (isStaff) {
    await requirePermission(event, 'APPOINTMENTS', 'DELETE')
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

  if (!isStaff && booking.userId !== auth.userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  if (booking.status === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Booking is already cancelled' })
  }

  if (!isStaff && booking.status === 'CONFIRMED') {
    // PENDING bookings have no doctor assigned yet and can be cancelled
    // immediately; the 24-hour rule protects confirmed doctor schedules only.
    const sessionStart = parseISODate(formatBookingDate(booking.date))
    const [h, m] = booking.startTime.split(':').map((p) => parseInt(p, 10))
    sessionStart.setHours(h || 0, m || 0, 0, 0)
    const hoursBefore = (sessionStart.getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursBefore < 24) {
      throw createError({ statusCode: 400, message: 'Cannot cancel booking less than 24 hours before session' })
    }
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
        formatBookingDate(booking.date),
        `${booking.startTime} – ${booking.endTime}`,
      ),
    })
  } catch (error) {
    console.error('[booking/cancel] Cancellation email could not be sent:', error)
  }

  return { message: 'Booking cancelled successfully' }
})

function formatBookingDate(date: Date): string {
  // `@db.Date` readback: use UTC components so the stored calendar day is
  // exact in every server timezone.
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
