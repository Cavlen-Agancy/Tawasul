import { describe, expect, it, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import handler from '~/modules/admin/server/api/admin/payments/index.get'
import { createApiEvent, createTestUser, deleteTestUser } from '../helpers'
import { deleteTestBooking } from '../booking/helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []

function staffContext(userId: string) {
  return { user: { userId, email: 'staff@test.com', accountType: 'STAFF' } }
}

async function staffWithRead(): Promise<string> {
  const staff = await createTestUser({
    emailVerified: true,
    accountType: 'STAFF',
    email: `apay-staff-${Date.now()}-${Math.random()}@test.com`,
    permissions: [{ resource: 'PAYMENTS', action: 'READ' }],
  })
  toDeleteUsers.push(staff.id)
  return staff.id
}

async function createPayment(status: 'SUCCESS' | 'REFUNDED' | 'FAILED', amount: number): Promise<string> {
  const patient = await createTestUser({ emailVerified: true, email: `apay-p-${Date.now()}-${Math.random()}@test.com` })
  toDeleteUsers.push(patient.id)
  const booking = await prisma.booking.create({
    data: {
      userId: patient.id,
      doctorId: null,
      date: new Date('2030-09-10T00:00:00'),
      startTime: '10:00',
      endTime: '11:00',
      service: 'Online Consultation',
      status: 'CONFIRMED',
    },
  })
  await prisma.payment.create({ data: { bookingId: booking.id, amount, currency: 'EGP', status } })
  toDeleteBookings.push(booking.id)
  return booking.id
}

afterAll(async () => {
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('GET /api/admin/payments', () => {
  it('returns payments with a summary', async () => {
    const staffId = await staffWithRead()
    await createPayment('SUCCESS', 500)
    const res = await handler(createApiEvent({
      method: 'GET',
      url: '/api/admin/payments',
      context: staffContext(staffId),
    })) as {
      payments: Array<{ status: string; amount: number }>
      summary: { totalRevenue: number; totalRevenueThisMonth: number; totalRefunded: number }
    }
    expect(Array.isArray(res.payments)).toBe(true)
    expect(res.summary.totalRevenue).toBeGreaterThanOrEqual(500)
    expect(res.summary.totalRevenueThisMonth).toBeGreaterThanOrEqual(0)
  })

  it('filters by status', async () => {
    const staffId = await staffWithRead()
    await createPayment('REFUNDED', 200)
    const res = await handler(createApiEvent({
      method: 'GET',
      url: '/api/admin/payments?status=REFUNDED',
      context: staffContext(staffId),
    })) as { payments: Array<{ status: string }> }
    expect(res.payments.length).toBeGreaterThan(0)
    expect(res.payments.every((p) => p.status === 'REFUNDED')).toBe(true)
  })
})
