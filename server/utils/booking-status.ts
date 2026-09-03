import { prisma } from '~/server/utils/prisma'
import { sendEmail, bookingReceivedTemplate } from '~/server/utils/email'

/**
 * Marks a payment as successful (idempotent) and sends a "booking received"
 * acknowledgment email to the patient. The booking stays PENDING until an admin
 * assigns a doctor (Phase 6), at which point confirmation emails are sent.
 * Never throws — callers already returned 200.
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

    if (booking.payment?.status !== 'SUCCESS') {
      await prisma.payment.update({
        where: { bookingId },
        data: { status: 'SUCCESS' },
      })
    }

    const dateLabel = formatBookingDateLabel(booking.date)
    const timeLabel = `${booking.startTime} – ${booking.endTime}`

    // Send the acknowledgment email to the patient. (If an admin already
    // confirmed the booking, we skip the acknowledgment to avoid a duplicate.)
    if (booking.status === 'PENDING') {
      try {
        await sendEmail({
          to: booking.user.email,
          subject: 'Your booking request has been received — Tawasul Academy',
          html: bookingReceivedTemplate(booking.user.name, dateLabel, timeLabel),
        })
      } catch (error) {
        console.error('[payment] Booking received email to patient failed:', error)
      }
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
