import { defineEventHandler, getQuery, sendRedirect, createError } from 'h3'
import { paymentGatewayConfigured } from '~/server/utils/payment'
import { handleSuccessfulPayment } from '~/server/utils/booking-status'
import { prisma } from '~/server/utils/prisma'

/**
 * POST /api/payment/dev/complete
 * Development-only mock payment completion used when the payment gateway is not
 * configured (placeholder keys). Simulates a successful gateway redirect so the
 * booking flow is testable end-to-end without a real payment provider.
 */
export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  if (paymentGatewayConfigured()) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const query = getQuery(event)
  const bookingId = typeof query.bookingId === 'string' ? query.bookingId : undefined
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const payment = await prisma.payment.findUnique({
    where: { bookingId },
    select: { amount: true, currency: true },
  })
  if (!payment) {
    throw createError({ statusCode: 400, message: 'Payment not found' })
  }
  const confirmed = await handleSuccessfulPayment(bookingId, {
    amount: Number(payment.amount),
    currency: payment.currency,
  })
  if (!confirmed) {
    throw createError({ statusCode: 400, message: 'Invalid payment data' })
  }
  await sendRedirect(event, `/booking/success?bookingId=${encodeURIComponent(bookingId)}`, 302)
})
