import { describe, expect, it, afterAll, afterEach, vi } from 'vitest'
import handler from '~/modules/payment/server/api/payment/initiate.post'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { createTestDoctor, deleteTestDoctor, deleteTestBooking, nextDateWithDayOfWeek } from '../booking/helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []
let doctorUserId: string | null = null
let doctorId: string | null = null

async function createOwnedBooking(ownerId: string, status = 'PENDING') {
  const dateStr = nextDateWithDayOfWeek(0)
  const fixture = await createTestDoctor({
    dayOfWeek: new Date(`${dateStr}T00:00:00`).getDay(),
    startTime: '09:00',
    endTime: '12:00',
    sessionDuration: 60,
  })
  doctorId = fixture.doctor.id
  doctorUserId = fixture.user.id

  const booking = await prisma.booking.create({
    data: {
      userId: ownerId,
      doctorId: fixture.doctor.id,
      date: new Date(`${dateStr}T00:00:00`),
      startTime: '09:00',
      endTime: '10:00',
      service: 'Marital Counseling',
      status: status as 'PENDING' | 'CONFIRMED',
    },
  })
  await prisma.payment.create({
    data: { bookingId: booking.id, amount: 500, currency: 'EGP', status: 'PENDING' },
  })
  toDeleteBookings.push(booking.id)
  return booking.id
}

function setEnv(gateway: string | undefined, partial: Record<string, string | undefined> = {}) {
  if (gateway === undefined) delete process.env.PAYMENT_GATEWAY
  else process.env.PAYMENT_GATEWAY = gateway
  process.env.PAYMOB_API_KEY = partial.paymobApiKey ?? 'your_paymob_api_key'
  process.env.PAYMOB_INTEGRATION_ID = partial.paymobIntegrationId ?? '111111'
  process.env.STRIPE_SECRET_KEY = partial.stripeSecretKey ?? 'sk_test_xxxxxxxxxxxxxxxxxxxx'
  process.env.APP_URL = 'http://localhost:3000'
}

afterEach(() => {
  vi.unstubAllEnvs()
})

afterAll(async () => {
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  if (doctorId && doctorUserId) await deleteTestDoctor(doctorId, doctorUserId)
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('POST /api/payment/initiate', () => {
  it('returns 500 when no payment gateway is configured', async () => {
    setEnv(undefined)
    const patient = await createTestUser({ emailVerified: true, email: `pay-nogw-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createOwnedBooking(patient.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/payment/initiate',
      context: { user: { userId: patient.id, email: 'x', accountType: 'PATIENT' } },
      body: { bookingId },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 500, 'Payment gateway not configured')
    }
  })

  it('returns a mock paymentUrl for Paymob when using placeholder keys', async () => {
    setEnv('paymob', { paymobApiKey: 'your_paymob_api_key', paymobIntegrationId: 'your_paymob_integration_id' })
    const patient = await createTestUser({ emailVerified: true, email: `pay-paymob-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createOwnedBooking(patient.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/payment/initiate',
      context: { user: { userId: patient.id, email: 'x', accountType: 'PATIENT' } },
      body: { bookingId },
    })
    const res = await handler(event) as { paymentUrl: string }
    expect(typeof res.paymentUrl).toBe('string')
    expect(res.paymentUrl).toContain('/api/payment/dev/complete')
    expect(res.paymentUrl).toContain('bookingId=')
  })

  it('returns a mock paymentUrl for Stripe when using placeholder keys', async () => {
    setEnv('stripe', { stripeSecretKey: 'sk_test_xxxxxxxxxxxxxxxxxxxx' })
    const patient = await createTestUser({ emailVerified: true, email: `pay-stripe-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createOwnedBooking(patient.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/payment/initiate',
      context: { user: { userId: patient.id, email: 'x', accountType: 'PATIENT' } },
      body: { bookingId },
    })
    const res = await handler(event) as { paymentUrl: string }
    expect(typeof res.paymentUrl).toBe('string')
    expect(res.paymentUrl).toContain('/api/payment/dev/complete')
    expect(res.paymentUrl).toContain('bookingId=')
  })

  it('returns 400 for a nonexistent bookingId', async () => {
    setEnv('paymob')
    const patient = await createTestUser({ emailVerified: true, email: `pay-notfound-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const event = createApiEvent({
      method: 'POST',
      url: '/api/payment/initiate',
      context: { user: { userId: patient.id, email: 'x', accountType: 'PATIENT' } },
      body: { bookingId: 'nonexistent' },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Booking not found')
    }
  })

  it('returns 403 initiating another user\'s booking', async () => {
    setEnv('paymob')
    const owner = await createTestUser({ emailVerified: true, email: `pay-owner-${Date.now()}@test.com` })
    const other = await createTestUser({ emailVerified: true, email: `pay-other-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id, other.id)
    const bookingId = await createOwnedBooking(owner.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/payment/initiate',
      context: { user: { userId: other.id, email: 'x', accountType: 'PATIENT' } },
      body: { bookingId },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })

  it('returns 400 when the booking is already confirmed', async () => {
    setEnv('paymob')
    const patient = await createTestUser({ emailVerified: true, email: `pay-conf-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const bookingId = await createOwnedBooking(patient.id, 'CONFIRMED')

    const event = createApiEvent({
      method: 'POST',
      url: '/api/payment/initiate',
      context: { user: { userId: patient.id, email: 'x', accountType: 'PATIENT' } },
      body: { bookingId },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Booking already confirmed')
    }
  })
})
