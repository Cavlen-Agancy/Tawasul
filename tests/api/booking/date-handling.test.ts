import { describe, expect, it, afterAll } from 'vitest'
import createHandler from '~/modules/booking/server/api/booking/create.post'
import getByIdHandler from '~/modules/booking/server/api/booking/[id].get'
import slotsHandler from '~/modules/booking/server/api/booking/available-slots.get'
import appointmentsHandler from '~/modules/patient/server/api/patient/appointments.get'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, createTestUser, deleteTestUser } from '../helpers'
import { createTestAdminSchedule, deleteTestAdminSchedule, deleteTestBooking, nextDateWithDayOfWeek } from './helpers'

/**
 * Regression tests for the calendar off-by-one bug: a patient booking
 * Saturday 2026-09-12 (example) used to be stored as 2026-09-11, so the
 * calendar dot and panel showed it on the previous day.
 *
 * Root cause was local-midnight `Date` writes to `@db.Date` columns on
 * UTC+X servers. The contract now: write/query with UTC-midnight Dates and
 * render readbacks with UTC components.
 */
describe('booking calendar-day handling (no off-by-one)', () => {
  const toDeleteUsers: string[] = []
  const toDeleteBookings: string[] = []
  const toDeleteSchedules: string[] = []

  afterAll(async () => {
    await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
    await Promise.all(toDeleteSchedules.map((id) => deleteTestAdminSchedule(id)))
    await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
  })

  it('POST /api/booking/create stores the requested calendar day exactly', async () => {
    const patient = await createTestUser({ emailVerified: true, email: `day-ok-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)

    const dateStr = nextDateWithDayOfWeek(0)
    const { adminScheduleId } = await createTestAdminSchedule({
      dayOfWeek: 0,
      startTime: '09:00',
      endTime: '12:00',
      sessionDuration: 60,
    })
    toDeleteSchedules.push(adminScheduleId)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/booking/create',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      body: { date: dateStr, startTime: '09:00' },
    })
    const res = await createHandler(event) as { bookingId: string }
    toDeleteBookings.push(res.bookingId)

    // Ground truth: the raw `date` column must equal the requested string.
    const raw = await prisma.$queryRaw<Array<{ d: string }>>`SELECT date::text AS d FROM bookings WHERE id = ${res.bookingId}`
    expect(raw[0]?.d).toBe(dateStr)

    // API readbacks must echo the requested day, not the previous one.
    const got = await getByIdHandler(createApiEvent({
      method: 'GET',
      url: `/api/booking/${res.bookingId}`,
      context: { params: { id: res.bookingId }, user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
    })) as { date: string }
    expect(got.date).toBe(dateStr)

    const all = await appointmentsHandler(createApiEvent({
      method: 'GET',
      url: '/api/patient/appointments?tab=all',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
    })) as { appointments: Array<{ id: string; date: string }> }
    const mine = all.appointments.find((a) => a.id === res.bookingId)
    expect(mine?.date).toBe(dateStr)

    const upcoming = await appointmentsHandler(createApiEvent({
      method: 'GET',
      url: '/api/patient/appointments?tab=upcoming',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
    })) as { appointments: Array<{ id: string; date: string }> }
    // A PENDING future booking is not in "upcoming" (CONFIRMED-only tab); it
    // must not leak into the wrong day either way — covered by `all` above.
    expect(upcoming.appointments.map((a) => a.id)).not.toContain(res.bookingId)
  })

  it('a CONFIRMED booking blocks its slot on its own day', async () => {
    const patient = await createTestUser({ emailVerified: true, email: `day-block-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)

    const dateStr = nextDateWithDayOfWeek(0)
    const { adminScheduleId } = await createTestAdminSchedule({
      dayOfWeek: 0,
      startTime: '09:00',
      endTime: '12:00',
      sessionDuration: 60,
    })
    toDeleteSchedules.push(adminScheduleId)

    const created = await createHandler(createApiEvent({
      method: 'POST',
      url: '/api/booking/create',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      body: { date: dateStr, startTime: '09:00' },
    })) as { bookingId: string }
    toDeleteBookings.push(created.bookingId)
    await prisma.booking.update({ where: { id: created.bookingId }, data: { status: 'CONFIRMED' } })

    const res = await slotsHandler(createApiEvent({
      method: 'GET',
      url: `/api/booking/available-slots?date=${dateStr}`,
    })) as { slots: Array<{ startTime: string }> }
    const times = res.slots.map((s) => s.startTime)
    // 09:00 is taken on the booked day itself (not shifted to another day).
    expect(times).not.toContain('09:00')
    expect(times).toContain('10:00')
    expect(times).toContain('11:00')
  })
})
