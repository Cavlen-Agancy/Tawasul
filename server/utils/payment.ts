import { getServerRuntimeConfig } from '~/server/utils/runtime'

export interface PaymentSession {
  paymentUrl?: string
  clientSecret?: string
}

const PLACEHOLDER_MARKERS = ['your_', 'sk_test_xxxxxxxx', 'pk_test_xxxxxxxx', 'whsec_xxxxxxxx', 'x_']

function isConfiguredKey(value: string | undefined | null): boolean {
  if (!value) return false
  for (const marker of PLACEHOLDER_MARKERS) {
    if (value.includes(marker)) return false
  }
  return value.length > 10
}

export function paymentGatewayConfigured(): boolean {
  const config = getServerRuntimeConfig()
  const gateway = config?.paymentGateway ?? process.env.PAYMENT_GATEWAY
  if (!gateway) return false

  if (gateway === 'stripe') {
    return isConfiguredKey(config?.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY)
  }

  return (
    isConfiguredKey(config?.paymobApiKey ?? process.env.PAYMOB_API_KEY) &&
    isConfiguredKey((config?.paymobIntegrationId ?? process.env.PAYMOB_INTEGRATION_ID) as string)
  )
}

/**
 * Initiates a payment session for a booking.
 * Returns { paymentUrl } for Paymob, { clientSecret } for Stripe.
 * When the gateway is not properly configured (placeholder keys), falls back to a
 * local mock payment URL so the end-to-end flow stays testable in development.
 */
export async function createPaymentSession(input: {
  bookingId: string
  amount: number
  currency: string
}): Promise<PaymentSession> {
  const config = getServerRuntimeConfig()
  const gateway = config?.paymentGateway ?? process.env.PAYMENT_GATEWAY
  if (!gateway) {
    throw createPaymentError('Payment gateway not configured')
  }

  const appUrl = config?.public?.appUrl ?? process.env.APP_URL ?? 'http://localhost:3000'

  if (gateway === 'stripe') {
    const secretKey = config?.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY
    if (!isConfiguredKey(secretKey)) {
      return {
        paymentUrl: `/api/payment/dev/complete?bookingId=${encodeURIComponent(input.bookingId)}`,
      }
    }
    return createStripeSession(input, secretKey as string, appUrl)
  }

  // Paymob
  const apiKey = config?.paymobApiKey ?? process.env.PAYMOB_API_KEY
  const integrationId = config?.paymobIntegrationId ?? process.env.PAYMOB_INTEGRATION_ID
  if (!isConfiguredKey(apiKey) || !isConfiguredKey(integrationId as string)) {
    return {
      paymentUrl: `/api/payment/dev/complete?bookingId=${encodeURIComponent(input.bookingId)}`,
    }
  }
  return createPaymobSession(input, apiKey as string, integrationId as string, appUrl)
}

async function createStripeSession(input: { bookingId: string; amount: number; currency: string }, secretKey: string, appUrl: string): Promise<PaymentSession> {
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(secretKey)
  const amountCents = Math.round(input.amount * 100)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: input.currency.toLowerCase(),
          product_data: { name: 'Tawasul Academy Session' },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: { bookingId: input.bookingId },
    success_url: `${appUrl}/booking/success?bookingId=${encodeURIComponent(input.bookingId)}`,
    cancel_url: `${appUrl}/booking/failed?bookingId=${encodeURIComponent(input.bookingId)}`,
  })
  return {
    clientSecret: (session as { client_secret?: string }).client_secret ?? session.id,
  }
}

async function createPaymobSession(
  input: { bookingId: string; amount: number; currency: string },
  apiKey: string,
  integrationId: string,
  appUrl: string,
): Promise<PaymentSession> {
  const amountCents = Math.round(input.amount * 100)
  const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })
  if (!authRes.ok) {
    throw createPaymentError('Payment gateway error')
  }
  const auth = (await authRes.json()) as { token?: string }
  if (!auth.token) {
    throw createPaymentError('Payment gateway error')
  }

  const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: auth.token,
      delivery_needed: 'false',
      amount_cents: amountCents,
      currency: input.currency,
      items: [],
    }),
  })
  if (!orderRes.ok) {
    throw createPaymentError('Payment gateway error')
  }
  const order = (await orderRes.json()) as { id?: string }
  if (!order.id) {
    throw createPaymentError('Payment gateway error')
  }

  const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: auth.token,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: order.id,
      billing_data: {
        apartment: 'NA',
        email: 'booking@tawasul.com',
        floor: 'NA',
        first_name: 'Tawasul',
        street: 'NA',
        building: 'NA',
        phone_number: '+200000000000',
        shipping_method: 'PKT',
        postal_code: '00000',
        city: 'Cairo',
        country: 'EG',
        last_name: 'Academy',
        state: 'Cairo',
      },
      currency: input.currency,
      integration_id: Number(integrationId),
      lock_order_when_paid: 'true',
    }),
  })
  if (!keyRes.ok) {
    throw createPaymentError('Payment gateway error')
  }
  const key = (await keyRes.json()) as { token?: string }
  if (!key.token) {
    throw createPaymentError('Payment gateway error')
  }

  return {
    paymentUrl: `https://accept.paymob.com/api/acceptance/iframes/${integrationId}?payment_token=${key.token}`,
  }
}

export function createPaymentError(message: string): Error {
  const err = new Error(message) as Error & { statusCode?: number }
  err.statusCode = 500
  return err
}
