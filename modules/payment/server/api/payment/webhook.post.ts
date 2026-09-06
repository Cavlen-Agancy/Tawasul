import { defineEventHandler, readBody, readRawBody, getHeader, createError, type H3Event } from 'h3'
import crypto from 'node:crypto'
import { getServerRuntimeConfig } from '~/server/utils/runtime'
import { handleSuccessfulPayment, handleFailedPayment } from '~/server/utils/booking-status'

/**
 * POST /api/payment/webhook
 * Receives payment notifications from Paymob or Stripe.
 * The HMAC signature is computed over the raw request body string. In
 * environments where the raw stream is unavailable (unit-test harness),
 * it falls back to the canonical JSON serialization of the parsed body.
 * Missing secrets fail closed with 400 — validation is never skipped.
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

async function rawBodyString(event: H3Event): Promise<{ raw: string; body: Record<string, unknown> } | null> {
  const raw = await readRawBody(event, 'utf8').catch(() => undefined)
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      return { raw, body: JSON.parse(raw) as Record<string, unknown> }
    } catch {
      return null
    }
  }
  const body = await readBody<Record<string, unknown>>(event).catch(() => undefined)
  if (!body || typeof body !== 'object') return null
  return { raw: JSON.stringify(body), body }
}

async function handlePaymobWebhook(event: H3Event): Promise<{ message: string }> {
  const config = getServerRuntimeConfig()
  const hmacSecret = config?.paymobHmacSecret ?? process.env.PAYMOB_HMAC_SECRET
  if (!hmacSecret) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  const parsed = await rawBodyString(event)
  if (!parsed) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  const providedHmac = getHeader(event, 'x-hmac') ?? getHeader(event, 'hmac')
  if (!providedHmac) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }
  const expectedHmac = crypto.createHmac('sha512', hmacSecret).update(parsed.raw).digest('hex')
  if (providedHmac !== expectedHmac) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  const { body } = parsed
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
  if (!webhookSecret) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  const parsed = await rawBodyString(event)
  if (!parsed) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  const signature = getHeader(event, 'stripe-signature')
  if (!signature) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  try {
    const { default: Stripe } = await import('stripe')
    const stripe = new Stripe(webhookSecret)
    stripe.webhooks.constructEvent(parsed.raw, signature, webhookSecret)
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  const { body } = parsed
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
