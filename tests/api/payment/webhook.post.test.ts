import { describe, expect, it, afterAll } from 'vitest'
import crypto from 'node:crypto'
import handler from '~/modules/payment/server/api/payment/webhook.post'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { deleteTestBooking, nextDateWithDayOfWeek } from '../booking/helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []

async function createPendingBooking(ownerId: string) {
  const dateStr = nextDateWithDayOfWeek(0)
  const booking = await prisma.booking.create({
    data: {
      userId: ownerId,
      doctorId: null,
      date: new Date(`${dateStr}T00:00:00`),
      startTime: '09:00',
      endTime: '10:00',
      service: 'Marital Counseling',
      status: 'PENDING',
    },
  })
  await prisma.payment.create({ data: { bookingId: booking.id, amount: 500, currency: 'EGP', status: 'PENDING' } })
  return booking.id
}

function buildApiEvent(body: Record<string, unknown>, headerName: string, headerValue: string) {
  const event = createApiEvent({
    method: 'POST',
    url: '/api/payment/webhook',
    body,
    context: {},
  })
  ;(event.node.req.headers as Record<string, string>)[headerName] = headerValue
  return event
}

afterAll(async () => {
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

function setPaymobEnv(hmacSecret: string | undefined) {
  process.env.PAYMENT_GATEWAY = 'paymob'
  if (hmacSecret === undefined) delete process.env.PAYMOB_HMAC_SECRET
  else process.env.PAYMOB_HMAC_SECRET = hmacSecret
}

function setStripeEnv(webhookSecret: string | undefined) {
  process.env.PAYMENT_GATEWAY = 'stripe'
  if (webhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
  else process.env.STRIPE_WEBHOOK_SECRET = webhookSecret
}

describe('POST /api/payment/webhook', () => {
  it('marks payment success but booking stays pending for a Paymob success webhook', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-paymob-ok-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)

    const body = { success: 'true', message: 'Approved', metadata: { bookingId } }
    const signature = crypto.createHmac('sha512', 'paymob-hmac-secret').update(JSON.stringify(body)).digest('hex')
    const event = buildApiEvent(body, 'hmac', signature)

    const res = await handler(event) as { message: string }
    expect(res.message).toBe('Webhook received')

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    const payment = await prisma.payment.findUnique({ where: { bookingId } })
    expect(booking?.status).toBe('PENDING')
    expect(payment?.status).toBe('SUCCESS')
  })

  it('marks payment failed and leaves booking pending on a Paymob failed webhook', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-paymob-fail-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)

    const body = { success: 'false', message: 'Declined', metadata: { bookingId } }
    const signature = crypto.createHmac('sha512', 'paymob-hmac-secret').update(JSON.stringify(body)).digest('hex')
    const event = buildApiEvent(body, 'hmac', signature)

    await handler(event)

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    const payment = await prisma.payment.findUnique({ where: { bookingId } })
    expect(booking?.status).toBe('PENDING')
    expect(payment?.status).toBe('FAILED')
  })

  it('rejects a Paymob webhook with an invalid signature with 400', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const event = buildApiEvent({ success: 'true', metadata: {} }, 'hmac', 'invalid-signature')
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid signature')
    }
  })

  it('marks payment success but booking stays pending for a Stripe success webhook', async () => {
    setStripeEnv('whsec_test_secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-stripe-ok-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)

    const body = { type: 'checkout.session.completed', metadata: { bookingId } }
    const raw = JSON.stringify(body)
    const t = Math.floor(Date.now() / 1000)
    const signature = `t=${t},v1=${crypto.createHmac('sha256', 'whsec_test_secret').update(`${t}.${raw}`).digest('hex')}`
    const event = buildApiEvent(body, 'stripe-signature', signature)

    const res = await handler(event) as { message: string }
    expect(res.message).toBe('Webhook received')

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    const payment = await prisma.payment.findUnique({ where: { bookingId } })
    expect(booking?.status).toBe('PENDING')
    expect(payment?.status).toBe('SUCCESS')
  })

  it('rejects a Stripe webhook with an invalid signature with 400', async () => {
    setStripeEnv('whsec_test_secret')
    const event = buildApiEvent({ type: 'checkout.session.completed', metadata: {} }, 'stripe-signature', 't=123,v1=invalid')
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid signature')
    }
  })

  it('rejects a Paymob webhook with 400 when the HMAC secret is missing', async () => {
    setPaymobEnv(undefined)
    const body = { success: 'true', metadata: {} }
    const event = buildApiEvent(body, 'x-hmac', 'anything')
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid signature')
    }
  })

  it('rejects a Stripe webhook with 400 when the webhook secret is missing', async () => {
    setStripeEnv(undefined)
    const body = { type: 'checkout.session.completed', metadata: {} }
    const event = buildApiEvent(body, 'stripe-signature', 't=123,v1=anything')
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid signature')
    }
  })

  it('accepts a Paymob webhook signed in the x-hmac header', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-paymob-xhmac-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)

    const body = { success: 'true', message: 'Approved', metadata: { bookingId } }
    const signature = crypto.createHmac('sha512', 'paymob-hmac-secret').update(JSON.stringify(body)).digest('hex')
    const event = buildApiEvent(body, 'x-hmac', signature)

    const res = await handler(event) as { message: string }
    expect(res.message).toBe('Webhook received')

    const payment = await prisma.payment.findUnique({ where: { bookingId } })
    expect(payment?.status).toBe('SUCCESS')
  })
})
