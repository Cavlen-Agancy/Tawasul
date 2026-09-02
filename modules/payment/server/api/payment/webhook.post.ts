import { defineEventHandler, readBody, getHeader, createError, type H3Event } from 'h3'
import crypto from 'node:crypto'
import { getServerRuntimeConfig } from '~/server/utils/runtime'
import { handleSuccessfulPayment, handleFailedPayment } from '~/server/utils/booking-status'

/**
 * POST /api/payment/webhook
 * Receives payment notifications from Paymob or Stripe.
 * Always returns 200 once the signature is valid — internal processing errors are
 * logged separately so the gateway doesn't retry-spam a transient failure.
 */
export default defineEventHandler(async (event) => {
  const config = getServerRuntimeConfig()
  const gateway = config?.paymentGateway ?? process.env.PAYMENT_GATEWAY ?? 'paymob'

  if (gateway === 'stripe') {
    return handleStripeWebhook(event)
  }
  return handlePaymobWebhook(event)
})

async function handlePaymobWebhook(event: H3Event): Promise<{ message: string }> {
  const config = getServerRuntimeConfig()
  const hmacSecret = config?.paymobHmacSecret ?? process.env.PAYMOB_HMAC_SECRET
  const body = await readBody<Record<string, unknown>>(event).catch(() => undefined)

  if (!body) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  if (hmacSecret) {
    const providedHmac = getHeader(event, 'hmac')
    if (!providedHmac) {
      throw createError({ statusCode: 400, message: 'Invalid signature' })
    }
    const expectedHmac = crypto.createHmac('sha512', hmacSecret).update(JSON.stringify(body)).digest('hex')
    if (providedHmac !== expectedHmac) {
      throw createError({ statusCode: 400, message: 'Invalid signature' })
    }
  }

  const success = String(body.success) === 'true'
  const bookingId = extractBookingId(body)
  if (bookingId) {
    if (success) {
      await handleSuccessfulPayment(bookingId)
    } else {
      await handleFailedPayment(bookingId)
    }
  }

  return { message: 'Webhook received' }
}

async function handleStripeWebhook(event: H3Event): Promise<{ message: string }> {
  const config = getServerRuntimeConfig()
  const webhookSecret = config?.stripeWebhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET
  const body = await readBody<Record<string, unknown>>(event).catch(() => undefined)

  if (!body) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  if (webhookSecret) {
    const signature = getHeader(event, 'stripe-signature')
    if (!signature) {
      throw createError({ statusCode: 400, message: 'Invalid signature' })
    }
    const expected = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(body)).digest('hex')
    if (signature !== expected) {
      throw createError({ statusCode: 400, message: 'Invalid signature' })
    }
  }

  const bookingId = extractBookingId(body)
  const type = typeof body.type === 'string' ? body.type : ''
  if (bookingId) {
    if (type === 'checkout.session.completed') {
      await handleSuccessfulPayment(bookingId)
    } else if (type === 'checkout.session.async_payment_failed') {
      await handleFailedPayment(bookingId)
    }
  }

  return { message: 'Webhook received' }
}

function extractBookingId(body: Record<string, unknown>): string | undefined {
  const metadata = body.metadata as Record<string, unknown> | undefined
  if (metadata && typeof metadata.bookingId === 'string') return metadata.bookingId

  const order = body.order as Record<string, unknown> | undefined
  if (order && typeof order.bookingId === 'string') return order.bookingId

  return undefined
}
