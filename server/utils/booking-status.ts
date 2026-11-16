import { prisma } from '~/server/utils/prisma'
import { sendEmail, bookingConfirmationTemplate } from '~/server/utils/email'
import { formatDateUTC } from '~/server/utils/availability'

export interface PaymentVerification {
  amount?: number
  currency?: string
}

interface ConfirmationContext {
  patientName: string
  patientEmail: string
  doctorName: string
  doctorEmail: string
  date: string
  time: string
  service: string
}

/**
 * Records a verified successful payment and confirms the booking once.
 *
 * Security:
 * - amount and currency are validated against the server-side Payment row when
 *   supplied by the gateway;
 * - Confirmation is conditional on the booking still being PENDING, its hold
 *   being active, and no other active booking occupying the doctor's slot;
 * - duplicate webhook deliveries are idempotent and do not resend email;
 * - cancelled and doctor-less legacy bookings never become CONFIRMED.
 */
export async function handleSuccessfulPayment(
  bookingId: string,
  verification: PaymentVerification = {},
): Promise<boolean> {
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${bookingId}`}), 0)`

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true,
        user: { select: { name: true, email: true } },
        doctor: { include: { user: { select: { name: true, email: true } } } },
      },
    })

    if (!booking || !booking.payment) {
      return { ok: false, confirmed: false as boolean, context: null as ConfirmationContext | null }
    }

    if (verification.amount !== undefined) {
      const expected = Math.round(Number(booking.payment.amount) * 100)
      const received = Math.round(verification.amount * 100)
      if (expected !== received) {
        console.error('[payment] Amount mismatch for booking', bookingId)
        return { ok: false, confirmed: false, context: null }
      }
    }
    if (verification.currency !== undefined) {
      if (booking.payment.currency.toUpperCase() !== verification.currency.toUpperCase()) {
        console.error('[payment] Currency mismatch for booking', bookingId)
        return { ok: false, confirmed: false, context: null }
      }
    }

    // Idempotent duplicate webhook: already confirmed and already paid.
    if (booking.payment.status === 'SUCCESS' && booking.status === 'CONFIRMED') {
      return { ok: true, confirmed: false, context: null }
    }

    // Never resurrect a cancelled booking. Record the verified payment for
    // manual reconciliation/refund, but do not confirm.
    if (booking.status === 'CANCELLED') {
      if (booking.payment.status !== 'SUCCESS') {
        await tx.payment.update({ where: { bookingId }, data: { status: 'SUCCESS' } })
      }
      return { ok: true, confirmed: false, context: null }
    }

    // Only a pending booking can become confirmed.
    if (booking.status !== 'PENDING') {
      return { ok: true, confirmed: false, context: null }
    }

    // A new online booking must have a doctor and an active hold. Legacy
    // doctor-less rows are left for admin remediation.
    if (!booking.doctorId || !booking.holdExpiresAt || booking.holdExpiresAt.getTime() <= now.getTime()) {
      if (booking.payment.status !== 'SUCCESS') {
        await tx.payment.update({ where: { bookingId }, data: { status: 'SUCCESS' } })
      }
      return { ok: true, confirmed: false, context: null }
    }

    // Serialize with booking creation for the same doctor/date/time.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${booking.doctorId}|${formatDateUTC(booking.date)}|${booking.startTime}`}), 0)`

    const conflict = await tx.booking.findFirst({
      where: {
        id: { not: booking.id },
        doctorId: booking.doctorId,
        date: booking.date,
        OR: [
          { status: 'CONFIRMED' },
          {
            status: 'PENDING',
            OR: [
              { holdExpiresAt: null },
              { holdExpiresAt: { gt: now } },
            ],
          },
        ],
      },
      select: { id: true },
    })

    if (conflict) {
      console.error('[payment] Slot conflict prevented confirmation for booking', bookingId)
      if (booking.payment.status !== 'SUCCESS') {
        await tx.payment.update({ where: { bookingId }, data: { status: 'SUCCESS' } })
      }
      return { ok: true, confirmed: false, context: null }
    }

    await tx.payment.update({ where: { bookingId }, data: { status: 'SUCCESS' } })
    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } })

    return {
      ok: true,
      confirmed: true,
      context: {
        patientName: booking.user.name,
        patientEmail: booking.user.email,
        doctorName: booking.doctor?.user.name ?? 'Tawasul Doctor',
        doctorEmail: booking.doctor?.user.email ?? '',
        date: booking.date.toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        }),
        time: `${booking.startTime} – ${booking.endTime}`,
        service: booking.service,
      },
    }
  })

  if (result.confirmed && result.context) {
    await sendConfirmationEmails(result.context)
  }

  return result.ok
}

async function sendConfirmationEmails(context: ConfirmationContext): Promise<void> {
  const html = bookingConfirmationTemplate(
    context.patientName,
    context.doctorName,
    context.date,
    context.time,
    context.service,
  )
  try {
    await sendEmail({
      to: context.patientEmail,
      subject: 'Your session is confirmed — Tawasul Academy',
      html,
    })
  } catch (error) {
    console.error('[payment] Patient confirmation email failed:', error)
  }

  if (context.doctorEmail) {
    try {
      await sendEmail({
        to: context.doctorEmail,
        subject: 'New confirmed appointment — Tawasul Academy',
        html: bookingConfirmationTemplate(
          context.doctorName,
          context.patientName,
          context.date,
          context.time,
          context.service,
        ),
      })
    } catch (error) {
      console.error('[payment] Doctor confirmation email failed:', error)
    }
  }
}

/** Marks a payment as failed but leaves the booking PENDING for retry. */
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
