import { defineEventHandler, readBody, readRawBody, getHeader, getQuery, createError, type H3Event } from 'h3'
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
    ?? (typeof getQuery(event).hmac === 'string' ? String(getQuery(event).hmac) : '')
  if (!providedHmac) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  const { body } = parsed
  const expectedHmac = crypto
    .createHmac('sha512', hmacSecret)
    .update(paymobHmacPayload(body))
    .digest('hex')
  if (!safeEqual(providedHmac, expectedHmac)) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  const payload = paymentPayload(body)
  const success = String(payload.success) === 'true'
  const bookingId = extractBookingId(body)
  if (bookingId) {
    if (success) {
      if (payload.amountCents === undefined || !payload.currency) {
        throw createError({ statusCode: 400, message: 'Invalid payment data' })
      }
      const verified = await handleSuccessfulPayment(bookingId, {
        amount: toMajorUnits(payload.amountCents),
        currency: payload.currency,
      })
      if (!verified) {
        throw createError({ statusCode: 400, message: 'Invalid payment data' })
      }
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
  const payload = paymentPayload(body)
  const bookingId = extractBookingId(body)
  const type = typeof body.type === 'string' ? body.type : ''
  if (bookingId) {
    if (type === 'checkout.session.completed') {
      if (payload.amountCents === undefined || !payload.currency) {
        throw createError({ statusCode: 400, message: 'Invalid payment data' })
      }
      const verified = await handleSuccessfulPayment(bookingId, {
        amount: toMajorUnits(payload.amountCents),
        currency: payload.currency,
      })
      if (!verified) {
        throw createError({ statusCode: 400, message: 'Invalid payment data' })
      }
    } else if (type === 'checkout.session.async_payment_failed') {
      await handleFailedPayment(bookingId)
    }
  }

  return { message: 'Webhook received' }
}

function safeEqual(actual: string, expected: string): boolean {
  const a = Buffer.from(actual, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * Paymob's official transaction HMAC concatenates these fields in order.
 * Missing fields are treated as empty strings; the gateway sends all fields.
 */
function paymobHmacPayload(body: Record<string, unknown>): string {
  const obj = (body.obj as Record<string, unknown> | undefined) ?? body
  const order = obj.order as Record<string, unknown> | undefined
  const source = obj.source_data as Record<string, unknown> | undefined
  const value = (input: unknown): string => {
    if (input === undefined || input === null) return ''
    return String(input)
  }
  return [
    value(obj.amount_cents),
    value(obj.created_at),
    value(obj.currency),
    value(obj.error_occured),
    value(obj.has_parent_transaction),
    value(obj.id),
    value(obj.integration_id),
    value(obj.is_3d_secure),
    value(obj.is_auth),
    value(obj.is_capture),
    value(obj.is_refunded),
    value(obj.is_standalone_payment),
    value(obj.is_voided),
    value(order?.id),
    value(obj.owner),
    value(obj.pending),
    value(source?.pan),
    value(source?.sub_type),
    value(source?.type),
    value(obj.success),
  ].join('')
}

function paymentPayload(body: Record<string, unknown>): {
  success: unknown
  amountCents?: number
  currency?: string
} {
  const data = body.data as Record<string, unknown> | undefined
  const nestedObject = data?.object as Record<string, unknown> | undefined
  const paymobObject = body.obj as Record<string, unknown> | undefined
  const source = nestedObject ?? paymobObject ?? body

  const rawAmount = source.amount_cents ?? source.amount_total ?? source.amount
  const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount)
  const currency = typeof source.currency === 'string' ? source.currency : undefined

  return {
    success: source.success ?? body.success,
    amountCents: Number.isFinite(amount) ? amount : undefined,
    currency,
  }
}

function toMajorUnits(amountCents: number | undefined): number | undefined {
  if (amountCents === undefined) return undefined
  return amountCents / 100
}

function extractBookingId(body: Record<string, unknown>): string | undefined {
  const data = body.data as Record<string, unknown> | undefined
  const nestedObject = data?.object as Record<string, unknown> | undefined
  const paymobObject = body.obj as Record<string, unknown> | undefined

  for (const source of [body, nestedObject, paymobObject]) {
    if (!source) continue
    const metadata = source.metadata as Record<string, unknown> | undefined
    if (metadata && typeof metadata.bookingId === 'string') return metadata.bookingId
    const order = source.order as Record<string, unknown> | undefined
    if (order && typeof order.bookingId === 'string') return order.bookingId
  }

  return undefined
}
