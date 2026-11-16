import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import crypto from 'node:crypto'
import handler from '~/modules/payment/server/api/payment/webhook.post'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { createTestDoctor, deleteTestDoctor, deleteTestBooking, nextDateWithDayOfWeek } from '../booking/helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []
let doctorFixture: Awaited<ReturnType<typeof createTestDoctor>>
let webhookBookingCounter = 0

async function createPendingBooking(ownerId: string) {
  const base = new Date(nextDateWithDayOfWeek(0) + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() + webhookBookingCounter * 7)
  webhookBookingCounter += 1
  const dateStr = base.toISOString().slice(0, 10)
  const booking = await prisma.booking.create({
    data: {
      userId: ownerId,
      doctorId: doctorFixture.doctor.id,
      date: new Date(`${dateStr}T00:00:00`),
      startTime: '09:00',
      endTime: '10:00',
      service: 'Marital Counseling',
      status: 'PENDING',
      sessionType: 'ONLINE',
      holdExpiresAt: new Date(Date.now() + 20 * 60 * 1000),
    },
  })
  await prisma.payment.create({ data: { bookingId: booking.id, amount: 500, currency: 'EGP', status: 'PENDING' } })
  return booking.id
}

function buildApiEvent(body: Record<string, unknown>, headerName: string, headerValue: string) {
  const event = createApiEvent({ method: 'POST', url: '/api/payment/webhook', body, context: {} })
  ;(event.node.req.headers as Record<string, string>)[headerName] = headerValue
  return event
}

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

function paymobBody(bookingId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    amount_cents: 50000,
    created_at: '2026-11-09T10:00:00.000000',
    currency: 'EGP',
    error_occured: 'false',
    has_parent_transaction: 'false',
    integration_id: '123',
    is_3d_secure: 'false',
    is_auth: 'false',
    is_capture: 'false',
    is_refunded: 'false',
    is_standalone_payment: 'true',
    is_voided: 'false',
    order: { id: 'order-1' },
    owner: 'owner-1',
    pending: 'false',
    source_data: { pan: '1234', sub_type: 'VISA', type: 'card' },
    success: 'true',
    message: 'Approved',
    metadata: { bookingId },
    ...overrides,
  }
}

function paymobSignature(body: Record<string, unknown>, secret = 'paymob-hmac-secret') {
  const obj = (body.obj as Record<string, unknown> | undefined) ?? body
  const order = obj.order as Record<string, unknown> | undefined
  const source = obj.source_data as Record<string, unknown> | undefined
  const value = (input: unknown) => (input === undefined || input === null ? '' : String(input))
  const payload = [
    value(obj.amount_cents), value(obj.created_at), value(obj.currency),
    value(obj.error_occured), value(obj.has_parent_transaction), value(obj.id),
    value(obj.integration_id), value(obj.is_3d_secure), value(obj.is_auth),
    value(obj.is_capture), value(obj.is_refunded), value(obj.is_standalone_payment),
    value(obj.is_voided), value(order?.id), value(obj.owner), value(obj.pending),
    value(source?.pan), value(source?.sub_type), value(source?.type), value(obj.success),
  ].join('')
  return crypto.createHmac('sha512', secret).update(payload).digest('hex')
}

beforeAll(async () => {
  doctorFixture = await createTestDoctor({ dayOfWeek: 0, startTime: '09:00', endTime: '17:00' })
})

afterAll(async () => {
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await deleteTestDoctor(doctorFixture.doctor.id, doctorFixture.user.id)
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('POST /api/payment/webhook', () => {
  it('automatically confirms a valid Paymob success webhook', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-paymob-ok-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)
    toDeleteBookings.push(bookingId)
    const body = paymobBody(bookingId)

    await handler(buildApiEvent(body, 'hmac', paymobSignature(body)))

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    const payment = await prisma.payment.findUnique({ where: { bookingId } })
    expect(booking?.status).toBe('CONFIRMED')
    expect(payment?.status).toBe('SUCCESS')
  })

  it('is idempotent for duplicate success webhooks', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-dup-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)
    toDeleteBookings.push(bookingId)
    const body = paymobBody(bookingId)
    const event = () => buildApiEvent(body, 'hmac', paymobSignature(body))

    await handler(event())
    await handler(event())

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(booking?.status).toBe('CONFIRMED')
  })

  it('rejects an amount mismatch and keeps the booking pending', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-amount-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)
    toDeleteBookings.push(bookingId)
    const body = paymobBody(bookingId, { amount_cents: 1 })

    try {
      await handler(buildApiEvent(body, 'hmac', paymobSignature(body)))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid payment data')
    }
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(booking?.status).toBe('PENDING')
  })

  it('rejects an incorrect currency and keeps the booking pending', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-currency-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)
    toDeleteBookings.push(bookingId)
    const body = paymobBody(bookingId, { currency: 'USD' })

    try {
      await handler(buildApiEvent(body, 'hmac', paymobSignature(body)))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid payment data')
    }
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(booking?.status).toBe('PENDING')
  })

  it('rejects an unknown booking reference', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const body = paymobBody('unknown-booking-id')
    try {
      await handler(buildApiEvent(body, 'hmac', paymobSignature(body)))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid payment data')
    }
  })

  it('handles concurrent duplicate success webhooks idempotently', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-concurrent-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)
    toDeleteBookings.push(bookingId)
    const body = paymobBody(bookingId)
    const signature = paymobSignature(body)

    const results = await Promise.allSettled([
      handler(buildApiEvent(body, 'hmac', signature)),
      handler(buildApiEvent(body, 'hmac', signature)),
    ])
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true)

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(booking?.status).toBe('CONFIRMED')
  })

  it('does not confirm an already paid booking with a different amount', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-lock-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)
    toDeleteBookings.push(bookingId)
    const validBody = paymobBody(bookingId)
    await handler(buildApiEvent(validBody, 'hmac', paymobSignature(validBody)))

    const tamperedBody = paymobBody(bookingId, { amount_cents: 1 })
    try {
      await handler(buildApiEvent(tamperedBody, 'hmac', paymobSignature(tamperedBody)))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid payment data')
    }
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(booking?.status).toBe('CONFIRMED')
  })

  it('marks a failed Paymob payment as FAILED and leaves the booking pending', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-fail-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)
    toDeleteBookings.push(bookingId)
    const body = paymobBody(bookingId, { success: 'false', amount_cents: undefined, currency: undefined })

    await handler(buildApiEvent(body, 'hmac', paymobSignature(body)))
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    const payment = await prisma.payment.findUnique({ where: { bookingId } })
    expect(booking?.status).toBe('PENDING')
    expect(payment?.status).toBe('FAILED')
  })

  it('rejects an invalid signature with 400', async () => {
    setPaymobEnv('paymob-hmac-secret')
    const event = buildApiEvent(paymobBody('missing'), 'hmac', 'invalid-signature')
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid signature')
    }
  })

  it('confirms a valid Stripe checkout.session.completed webhook', async () => {
    setStripeEnv('whsec_test_secret')
    const patient = await createTestUser({ emailVerified: true, email: `wh-stripe-ok-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createPendingBooking(patient.id)
    toDeleteBookings.push(bookingId)
    const body = {
      type: 'checkout.session.completed',
      data: { object: { metadata: { bookingId }, amount_total: 50000, currency: 'egp' } },
    }
    const raw = JSON.stringify(body)
    const t = Math.floor(Date.now() / 1000)
    const signature = `t=${t},v1=${crypto.createHmac('sha256', 'whsec_test_secret').update(`${t}.${raw}`).digest('hex')}`

    await handler(buildApiEvent(body, 'stripe-signature', signature))
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(booking?.status).toBe('CONFIRMED')
  })

  it('rejects a Stripe webhook with an invalid signature', async () => {
    setStripeEnv('whsec_test_secret')
    const event = buildApiEvent({ type: 'checkout.session.completed', data: { object: {} } }, 'stripe-signature', 't=123,v1=invalid')
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid signature')
    }
  })
})
