import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

vi.mock('../../server/utils/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}))

import { prisma } from '../../server/utils/prisma'
import { getAvailableSlots, getAvailableDates } from '../../server/utils/availability'

const mockedAvailability = vi.mocked(prisma.availability.findMany)
const mockedBookings = vi.mocked(prisma.booking.findMany)
const mockedBlocked = vi.mocked(prisma.blockedSlot.findMany)

function makeAvailability(opts: {
  doctorId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  sessionDuration: number
  doctorName: string
  specializations?: string[]
}) {
  return {
    id: `av-${opts.doctorId}`,
    doctorId: opts.doctorId,
    dayOfWeek: opts.dayOfWeek,
    startTime: opts.startTime,
    endTime: opts.endTime,
    sessionDuration: opts.sessionDuration,
    doctor: {
      id: opts.doctorId,
      isActive: true,
      specializations: opts.specializations ?? ['Marital Counseling'],
      user: { name: opts.doctorName },
    },
  } as never
}

function findNextDateWithDayOfWeek(targetDay: number): string {
  const now = new Date()
  const diff = (targetDay - now.getDay() + 7) % 7
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff + 7)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dayOfWeekOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay()
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getAvailableSlots', () => {
  it('returns slots for a date with availability', async () => {
    const dateStr = findNextDateWithDayOfWeek(0)
    mockedAvailability.mockResolvedValue([
      makeAvailability({
        doctorId: 'doc-1',
        dayOfWeek: dayOfWeekOf(dateStr),
        startTime: '09:00',
        endTime: '12:00',
        sessionDuration: 60,
        doctorName: 'Dr Sarah',
        specializations: ['Marital Counseling'],
      }),
    ])
    mockedBookings.mockResolvedValue([])
    mockedBlocked.mockResolvedValue([])

    const slots = await getAvailableSlots(dateStr)
    expect(slots).toHaveLength(3)
    expect(slots[0]).toMatchObject({
      doctorId: 'doc-1',
      startTime: '09:00',
      endTime: '10:00',
      doctorName: 'Dr Sarah',
      service: 'Marital Counseling',
    })
    expect(slots.map((s) => s.startTime)).toEqual(['09:00', '10:00', '11:00'])
  })

  it('excludes booked slots', async () => {
    const dateStr = findNextDateWithDayOfWeek(0)
    mockedAvailability.mockResolvedValue([
      makeAvailability({
        doctorId: 'doc-1',
        dayOfWeek: dayOfWeekOf(dateStr),
        startTime: '09:00',
        endTime: '12:00',
        sessionDuration: 60,
        doctorName: 'Dr Sarah',
      }),
    ])
    mockedBookings.mockResolvedValue([
      { doctorId: 'doc-1', date: new Date(`${dateStr}T00:00:00`), startTime: '10:00', endTime: '11:00', status: 'CONFIRMED' },
    ] as never)
    mockedBlocked.mockResolvedValue([])

    const slots = await getAvailableSlots(dateStr)
    expect(slots.map((s) => s.startTime)).toEqual(['09:00', '11:00'])
  })

  it('excludes blocked slots', async () => {
    const dateStr = findNextDateWithDayOfWeek(0)
    mockedAvailability.mockResolvedValue([
      makeAvailability({
        doctorId: 'doc-1',
        dayOfWeek: dayOfWeekOf(dateStr),
        startTime: '09:00',
        endTime: '12:00',
        sessionDuration: 60,
        doctorName: 'Dr Sarah',
      }),
    ])
    mockedBookings.mockResolvedValue([])
    mockedBlocked.mockResolvedValue([
      { doctorId: 'doc-1', date: new Date(`${dateStr}T00:00:00`), startTime: '11:00', endTime: '12:00' },
    ] as never)

    const slots = await getAvailableSlots(dateStr)
    expect(slots.map((s) => s.startTime)).toEqual(['09:00', '10:00'])
  })

  it('returns empty array for a date with no availability', async () => {
    mockedAvailability.mockResolvedValue([])
    mockedBookings.mockResolvedValue([])
    mockedBlocked.mockResolvedValue([])
    const slots = await getAvailableSlots(findNextDateWithDayOfWeek(0))
    expect(slots).toEqual([])
  })

  it('sorts slots by startTime ascending', async () => {
    const dateStr = findNextDateWithDayOfWeek(1)
    mockedAvailability.mockResolvedValue([
      makeAvailability({
        doctorId: 'doc-1',
        dayOfWeek: dayOfWeekOf(dateStr),
        startTime: '08:00',
        endTime: '11:00',
        sessionDuration: 30,
        doctorName: 'Dr Sarah',
      }),
    ])
    mockedBookings.mockResolvedValue([])
    mockedBlocked.mockResolvedValue([])

    const slots = await getAvailableSlots(dateStr)
    const times = slots.map((s) => s.startTime)
    expect([...times].sort()).toEqual(times)
  })
})

describe('getAvailableDates', () => {
  it('returns dates with available slots for the month', async () => {
    mockedAvailability.mockResolvedValue([
      makeAvailability({
        doctorId: 'doc-1',
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '10:00',
        sessionDuration: 60,
        doctorName: 'Dr Sarah',
      }),
    ])
    mockedBookings.mockResolvedValue([])
    mockedBlocked.mockResolvedValue([])

    const now = new Date()
    const dates = await getAvailableDates(now.getMonth() + 1, now.getFullYear())
    expect(Array.isArray(dates)).toBe(true)
    expect(dates.length).toBeGreaterThan(0)
    expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('excludes dates where all slots are booked', async () => {
    const now = new Date()
    mockedAvailability.mockResolvedValue([
      makeAvailability({
        doctorId: 'doc-1',
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '10:00',
        sessionDuration: 60,
        doctorName: 'Dr Sarah',
      }),
    ])

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const bookings: Array<{ doctorId: string; date: Date; startTime: string; endTime: string; status: string }> = []
    for (let d = new Date(monthStart); d <= monthEnd; d = new Date(d.getTime() + 86400000)) {
      if (d.getDay() === 0) {
        bookings.push({ doctorId: 'doc-1', date: new Date(d), startTime: '09:00', endTime: '10:00', status: 'CONFIRMED' })
      }
    }
    mockedBookings.mockResolvedValue(bookings as never)
    mockedBlocked.mockResolvedValue([])

    const dates = await getAvailableDates(now.getMonth() + 1, now.getFullYear())
    expect(dates).toEqual([])
  })

  it('returns empty array for a month with no availability', async () => {
    mockedAvailability.mockResolvedValue([])
    const now = new Date()
    const dates = await getAvailableDates(now.getMonth() + 1, now.getFullYear())
    expect(dates).toEqual([])
  })
})
