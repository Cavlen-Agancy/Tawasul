import { defineEventHandler, getQuery, sendRedirect, createError } from 'h3'
import { paymentGatewayConfigured } from '~/server/utils/payment'
import { handleSuccessfulPayment } from '~/server/utils/booking-status'

/**
 * POST /api/payment/dev/complete
 * Development-only mock payment completion used when the payment gateway is not
 * configured (placeholder keys). Simulates a successful gateway redirect so the
 * booking flow is testable end-to-end without a real payment provider.
 */
export default defineEventHandler(async (event) => {
  if (paymentGatewayConfigured()) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const query = getQuery(event)
  const bookingId = typeof query.bookingId === 'string' ? query.bookingId : undefined
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  await handleSuccessfulPayment(bookingId)
  await sendRedirect(event, `/booking/success?bookingId=${encodeURIComponent(bookingId)}`, 302)
})
