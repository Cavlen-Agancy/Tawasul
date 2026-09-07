import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/[id].patch'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { deleteTestBooking, createTestAdminSchedule, deleteTestAdminSchedule, restoreSeedWeekendSchedules } from './helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []
const toDeleteSchedules: string[] = []

let fixtureWeek = 0

/**
 * A unique future SATURDAY (dayOfWeek 6). The seed covers Saturdays, so tests
 * upsert their own Saturday schedule row and `restoreSeedWeekendSchedules()`
 * repairs the seed row in `afterAll`.
 */
function futureSaturday(): { date: Date; iso: string } {
  fixtureWeek += 1
  const now = new Date()
  const nextSat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((6 - now.getDay() + 7) % 7))
  nextSat.setDate(nextSat.getDate() + 7 * (fixtureWeek + 1))
  const y = nextSat.getFullYear()
  const m = String(nextSat.getMonth() + 1).padStart(2, '0')
  const day = String(nextSat.getDate()).padStart(2, '0')
  // `@db.Date` contract: fixture writes use UTC midnight (see prod create.post).
  return { date: new Date(Date.UTC(y, nextSat.getMonth(), nextSat.getDate())), iso: `${y}-${m}-${day}` }
}

async function ensureSaturdaySchedule(): Promise<void> {
  const { adminScheduleId } = await createTestAdminSchedule({
    dayOfWeek: 6, // Saturday — must match futureSaturday()
    startTime: '08:00',
    endTime: '20:00',
    sessionDuration: 60,
  })
  toDeleteSchedules.push(adminScheduleId)
}

async function createBooking(ownerId: string, date: Date, startTime: string, endTime: string): Promise<string> {
  const booking = await prisma.booking.create({
    data: {
      userId: ownerId,
      doctorId: null,
      date,
      startTime,
      endTime,
      service: 'Marital Counseling',
      status: 'PENDING',
    },
  })
  await prisma.payment.create({
    data: { bookingId: booking.id, amount: 100, currency: 'EGP', status: 'PENDING' },
  })
  toDeleteBookings.push(booking.id)
  return booking.id
}

afterAll(async () => {
  await Promise.all(toDeleteSchedules.map((id) => deleteTestAdminSchedule(id)))
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
  await restoreSeedWeekendSchedules()
})

describe('PATCH /api/booking/:id (patient reschedule)', () => {
  it('updates own booking to a new available slot', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-ok-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)

    const fix = futureSaturday()
    await ensureSaturdaySchedule()
    const bookingId = await createBooking(owner.id, fix.date, '09:00', '10:00')

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}`,
      body: { startTime: '11:00' },
      context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })
    const res = await handler(event) as { startTime: string; endTime: string; status: string }
    expect(res.startTime).toBe('11:00')
    expect(res.endTime).toBe('12:00')
    expect(res.status).toBe('PENDING')

    const updated = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(updated?.startTime).toBe('11:00')
    expect(updated?.endTime).toBe('12:00')
  })

  it('rejects a slot that overlaps another non-cancelled booking', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-conflict-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)

    const fix = futureSaturday()
    await ensureSaturdaySchedule()
    const bookingId = await createBooking(owner.id, fix.date, '09:00', '10:00')
    // A competing booking (different user) occupies 11:00.
    const otherUser = await createTestUser({ emailVerified: true, email: `edit-other-${Date.now()}@test.com` })
    toDeleteUsers.push(otherUser.id)
    await createBooking(otherUser.id, fix.date, '11:00', '12:00')

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}`,
      body: { startTime: '11:00' },
      context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'This slot is no longer available')
    }

    const updated = await prisma.booking.findUnique({ where: { id: bookingId } })
    expect(updated?.startTime).toBe('09:00')
  })

  it('allows the patient to keep their own current slot', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-keep-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)

    const fix = futureSaturday()
    await ensureSaturdaySchedule()
    const bookingId = await createBooking(owner.id, fix.date, '09:00', '10:00')

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}`,
      body: { startTime: '09:00' },
      context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })
    const res = await handler(event) as { startTime: string }
    expect(res.startTime).toBe('09:00')
  })

  it('rejects editing another user\'s booking (403)', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-anowner-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const other = await createTestUser({ emailVerified: true, email: `edit-another-${Date.now()}@test.com` })
    toDeleteUsers.push(other.id)

    const fix = futureSaturday()
    await ensureSaturdaySchedule()
    const bookingId = await createBooking(owner.id, fix.date, '09:00', '10:00')

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}`,
      body: { startTime: '11:00' },
      context: { params: { id: bookingId }, user: { userId: other.id, email: 'x', accountType: 'PATIENT' } },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })

  it('rejects editing a cancelled booking (400)', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-cancelled-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)

    const fix = futureSaturday()
    const bookingId = await createBooking(owner.id, fix.date, '09:00', '10:00')
    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}`,
      body: { startTime: '11:00' },
      context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Booking is already cancelled')
    }
  })

  it('rejects an invalid time format (400)', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-invalid-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)

    const fix = futureSaturday()
    const bookingId = await createBooking(owner.id, fix.date, '09:00', '10:00')

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/booking/${bookingId}`,
      body: { startTime: '25:99' },
      context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid request')
    }
  })
})
