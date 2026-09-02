import { prisma } from '~/server/utils/prisma'
import { sendEmail, bookingConfirmationTemplate } from '~/server/utils/email'

/**
 * Marks a booking + payment as successful (idempotent) and sends confirmation
 * emails to the patient and doctor. Never throws — callers already returned 200.
 */
export async function handleSuccessfulPayment(bookingId: string): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { name: true, email: true } },
        doctor: { include: { user: { select: { name: true, email: true } } } },
        payment: true,
      },
    })

    if (!booking) {
      console.error(`[payment] handleSuccessfulPayment: booking ${bookingId} not found`)
      return
    }

    if (booking.status !== 'CONFIRMED') {
      await prisma.$transaction([
        prisma.payment.update({
          where: { bookingId },
          data: { status: 'SUCCESS' },
        }),
        prisma.booking.update({
          where: { id: bookingId },
          data: { status: 'CONFIRMED' },
        }),
      ])
    } else if (booking.payment?.status !== 'SUCCESS') {
      await prisma.payment.update({
        where: { bookingId },
        data: { status: 'SUCCESS' },
      })
    }

    const dateLabel = formatBookingDateLabel(booking.date)
    const timeLabel = `${booking.startTime} – ${booking.endTime}`
    const doctorName = booking.doctor.user.name

    try {
      await sendEmail({
        to: booking.user.email,
        subject: 'Your Tawasul Academy session is confirmed',
        html: bookingConfirmationTemplate(booking.user.name, doctorName, dateLabel, timeLabel, booking.service),
      })
    } catch (error) {
      console.error('[payment] Confirmation email to patient failed:', error)
    }

    try {
      await sendEmail({
        to: booking.doctor.user.email,
        subject: 'New session booked with you on Tawasul Academy',
        html: bookingConfirmationTemplate(`Patient: ${booking.user.name}`, doctorName, dateLabel, timeLabel, booking.service),
      })
    } catch (error) {
      console.error('[payment] Notification email to doctor failed:', error)
    }
  } catch (error) {
    console.error('[payment] handleSuccessfulPayment failed:', error)
  }
}

/**
 * Marks a payment as failed but leaves the booking PENDING for retry.
 */
export async function handleFailedPayment(bookingId: string): Promise<void> {
  try {
    await prisma.payment.update({
      where: { bookingId },
      data: { status: 'FAILED' },
    })
  } catch (error) {
    console.error('[payment] handleFailedPayment failed:', error)
  }
}

function formatBookingDateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
