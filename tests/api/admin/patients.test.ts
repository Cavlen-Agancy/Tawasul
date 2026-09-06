import { describe, expect, it, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import listHandler from '~/modules/admin/server/api/admin/patients/index.get'
import detailHandler from '~/modules/admin/server/api/admin/patients/[id].get'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
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
    email: `apt-staff-${Date.now()}-${Math.random()}@test.com`,
    permissions: [{ resource: 'PATIENTS', action: 'READ' }],
  })
  toDeleteUsers.push(staff.id)
  return staff.id
}

afterAll(async () => {
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('GET /api/admin/patients', () => {
  it('returns patients with session counts', async () => {
    const staffId = await staffWithRead()
    const patient = await createTestUser({ emailVerified: true, email: `apt-p-${Date.now()}-${Math.random()}@test.com` })
    toDeleteUsers.push(patient.id)
    const booking = await prisma.booking.create({
      data: {
        userId: patient.id,
        doctorId: null,
        date: new Date('2030-10-10T12:00:00'),
        startTime: '10:00',
        endTime: '11:00',
        service: 'Online Consultation',
        status: 'CONFIRMED',
      },
    })
    toDeleteBookings.push(booking.id)

    const res = await listHandler(createApiEvent({
      method: 'GET',
      url: '/api/admin/patients',
      context: staffContext(staffId),
    })) as { patients: Array<{ id: string; totalSessions: number; lastSessionDate: string | null }> }
    const found = res.patients.find((p) => p.id === patient.id)
    expect(found?.totalSessions).toBe(1)
    expect(found?.lastSessionDate).toBe('2030-10-10')
  })

  it('supports search', async () => {
    const staffId = await staffWithRead()
    const unique = `apt-search-${Date.now()}`
    const patient = await createTestUser({ emailVerified: true, email: `${unique}@test.com` })
    toDeleteUsers.push(patient.id)

    const res = await listHandler(createApiEvent({
      method: 'GET',
      url: `/api/admin/patients?search=${unique}`,
      context: staffContext(staffId),
    })) as { patients: Array<{ id: string }> }
    expect(res.patients.find((p) => p.id === patient.id)).toBeTruthy()
  })
})

describe('GET /api/admin/patients/:id', () => {
  it('returns booking and payment history', async () => {
    const staffId = await staffWithRead()
    const patient = await createTestUser({ emailVerified: true, email: `apt-d-${Date.now()}-${Math.random()}@test.com` })
    toDeleteUsers.push(patient.id)
    const booking = await prisma.booking.create({
      data: {
        userId: patient.id,
        doctorId: null,
        date: new Date('2030-11-10T00:00:00'),
        startTime: '10:00',
        endTime: '11:00',
        service: 'Online Consultation',
        status: 'CONFIRMED',
      },
    })
    await prisma.payment.create({ data: { bookingId: booking.id, amount: 300, currency: 'EGP', status: 'SUCCESS' } })
    toDeleteBookings.push(booking.id)

    const res = await detailHandler(createApiEvent({
      method: 'GET',
      url: `/api/admin/patients/${patient.id}`,
      context: { params: { id: patient.id }, ...staffContext(staffId) },
    })) as { bookings: unknown[]; payments: Array<{ amount: number }> }
    expect(res.bookings).toHaveLength(1)
    expect(res.payments).toHaveLength(1)
    expect(res.payments[0].amount).toBe(300)
  })

  it('returns 404 for unknown patient', async () => {
    const staffId = await staffWithRead()
    try {
      await detailHandler(createApiEvent({
        method: 'GET',
        url: '/api/admin/patients/nope',
        context: { params: { id: 'nope' }, ...staffContext(staffId) },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 404, 'Patient not found')
    }
  })
})
