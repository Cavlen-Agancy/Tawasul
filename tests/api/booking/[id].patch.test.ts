import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/booking/server/api/booking/[id].patch'
import { prisma } from '~/server/utils/prisma'
import { isHoliday } from '~/server/utils/holidays'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { createTestDoctor, deleteTestDoctor, deleteTestBooking } from './helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []
const toDeleteDoctors: Array<{ doctorId: string; userId: string }> = []

let fixtureWeek = 0
const runWeekOffset = 520 + (Date.now() % 520)

function futureSaturday(): { date: Date; iso: string } {
  const now = new Date()
  const baseSaturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((6 - now.getDay() + 7) % 7))
  let nextSat = new Date(baseSaturday)
  let iso = ''
  do {
    fixtureWeek += 1
    nextSat = new Date(baseSaturday)
    nextSat.setDate(nextSat.getDate() + 7 * (fixtureWeek + 1 + runWeekOffset))
    const y = nextSat.getFullYear()
    const m = String(nextSat.getMonth() + 1).padStart(2, '0')
    const day = String(nextSat.getDate()).padStart(2, '0')
    iso = `${y}-${m}-${day}`
  } while (isHoliday(iso))
  return { date: new Date(Date.UTC(nextSat.getFullYear(), nextSat.getMonth(), nextSat.getDate())), iso }
}

async function createDoctor() {
  const doctor = await createTestDoctor({ dayOfWeek: 6, startTime: '08:00', endTime: '20:00', sessionDuration: 60 })
  toDeleteDoctors.push({ doctorId: doctor.doctor.id, userId: doctor.user.id })
  return doctor
}

async function createBooking(ownerId: string, doctorId: string, date: Date, startTime: string, endTime: string, status: 'PENDING' | 'CANCELLED' = 'PENDING'): Promise<string> {
  const booking = await prisma.booking.create({
    data: {
      userId: ownerId,
      doctorId,
      date,
      startTime,
      endTime,
      service: 'Marital Counseling',
      status,
      sessionType: 'ONLINE',
      holdExpiresAt: status === 'PENDING' ? new Date(Date.now() + 20 * 60 * 1000) : null,
    },
  })
  await prisma.payment.create({ data: { bookingId: booking.id, amount: 100, currency: 'EGP', status: 'PENDING' } })
  toDeleteBookings.push(booking.id)
  return booking.id
}

afterAll(async () => {
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await Promise.all(toDeleteDoctors.map(({ doctorId, userId }) => deleteTestDoctor(doctorId, userId)))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('PATCH /api/booking/:id (patient reschedule)', () => {
  it('updates own booking to a new available slot', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-ok-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const doctor = await createDoctor()
    const fix = futureSaturday()
    const bookingId = await createBooking(owner.id, doctor.doctor.id, fix.date, '09:00', '10:00')

    const res = await handler(createApiEvent({
      method: 'PATCH', url: `/api/booking/${bookingId}`, body: { startTime: '11:00' },
      context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })) as { startTime: string; endTime: string; status: string }
    expect(res.startTime).toBe('11:00')
    expect(res.endTime).toBe('12:00')
    expect(res.status).toBe('PENDING')
  })

  it('rejects a slot that overlaps another non-cancelled booking', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-conflict-${Date.now()}@test.com` })
    const other = await createTestUser({ emailVerified: true, email: `edit-other-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id, other.id)
    const doctor = await createDoctor()
    const fix = futureSaturday()
    const bookingId = await createBooking(owner.id, doctor.doctor.id, fix.date, '09:00', '10:00')
    await createBooking(other.id, doctor.doctor.id, fix.date, '11:00', '12:00')

    try {
      await handler(createApiEvent({
        method: 'PATCH', url: `/api/booking/${bookingId}`, body: { startTime: '11:00' },
        context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'This slot is no longer available')
    }
  })

  it('allows the patient to keep their own current slot', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-keep-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const doctor = await createDoctor()
    const fix = futureSaturday()
    const bookingId = await createBooking(owner.id, doctor.doctor.id, fix.date, '09:00', '10:00')

    const res = await handler(createApiEvent({
      method: 'PATCH', url: `/api/booking/${bookingId}`, body: { startTime: '09:00' },
      context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
    })) as { startTime: string }
    expect(res.startTime).toBe('09:00')
  })

  it('rejects editing another user\'s booking (403)', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-anowner-${Date.now()}@test.com` })
    const other = await createTestUser({ emailVerified: true, email: `edit-another-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id, other.id)
    const doctor = await createDoctor()
    const fix = futureSaturday()
    const bookingId = await createBooking(owner.id, doctor.doctor.id, fix.date, '09:00', '10:00')

    try {
      await handler(createApiEvent({
        method: 'PATCH', url: `/api/booking/${bookingId}`, body: { startTime: '11:00' },
        context: { params: { id: bookingId }, user: { userId: other.id, email: 'x', accountType: 'PATIENT' } },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })

  it('rejects editing a cancelled booking (400)', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-cancelled-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const doctor = await createDoctor()
    const fix = futureSaturday()
    const bookingId = await createBooking(owner.id, doctor.doctor.id, fix.date, '09:00', '10:00', 'CANCELLED')

    try {
      await handler(createApiEvent({
        method: 'PATCH', url: `/api/booking/${bookingId}`, body: { startTime: '11:00' },
        context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Booking is already cancelled')
    }
  })

  it('rejects an invalid time format (400)', async () => {
    const owner = await createTestUser({ emailVerified: true, email: `edit-invalid-${Date.now()}@test.com` })
    toDeleteUsers.push(owner.id)
    const doctor = await createDoctor()
    const fix = futureSaturday()
    const bookingId = await createBooking(owner.id, doctor.doctor.id, fix.date, '09:00', '10:00')

    try {
      await handler(createApiEvent({
        method: 'PATCH', url: `/api/booking/${bookingId}`, body: { startTime: '25:99' },
        context: { params: { id: bookingId }, user: { userId: owner.id, email: 'x', accountType: 'PATIENT' } },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid request')
    }
  })
})
