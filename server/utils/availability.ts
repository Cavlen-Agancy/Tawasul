import { prisma } from '~/server/utils/prisma'
import { isHoliday } from '~/server/utils/holidays'

export interface Slot {
  doctorId: string
  doctorName: string
  startTime: string
  endTime: string
  sessionDuration: number
  service: string
}

const DEFAULT_SERVICE = 'Online Consultation'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Converts an "HH:MM" string into the number of minutes since midnight.
 * e.g. "09:30" -> 570
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((p) => parseInt(p, 10))
  return (h || 0) * 60 + (m || 0)
}

/**
 * Formats a date object as "YYYY-MM-DD" in local time.
 */
export function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * Formats a Date into a human-readable label like "Monday, 4 March 2024".
 */
export function formatBookingDateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Parses "YYYY-MM-DD" into a local Date at midnight.
 */
export function parseISODate(date: string): Date {
  const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
  return new Date(y, m - 1, d)
}

/**
 * Calendar-day helpers for Prisma `@db.Date` columns.
 *
 * `@db.Date` stores a bare calendar day (no time). Prisma materialises it as
 * a Date at UTC midnight, and the pg driver serialises a Date to its UTC
 * calendar day when writing to a `date` column (verified: a local-midnight
 * write from a UTC+X server stored the PREVIOUS day, e.g. Africa/Cairo).
 *
 * Contract — use ONLY these two at `@db.Date` read/write/query boundaries:
 * - write/query with `parseDateUTC('YYYY-MM-DD')`
 * - render readbacks with `formatDateUTC(date)`
 * Never use the local-time `parseISODate`/`formatDateISO` there: they shift
 * the day whenever the server offset is not UTC.
 */
export function parseDateUTC(date: string): Date {
  const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
}

/**
 * Formats a `@db.Date` readback as "YYYY-MM-DD" using UTC components, so the
 * stored calendar day round-trips exactly in every server timezone.
 */
export function formatDateUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/**
 * Checks whether a slot [slotStart, slotEnd) overlaps a blocked window [blockStart, blockEnd).
 * Overlap is true when the slot start is before the block end AND the slot end is after the block start.
 */
function overlaps(blockStart: number, blockEnd: number, slotStart: number, slotEnd: number): boolean {
  return slotStart < blockEnd && slotEnd > blockStart
}

function serviceFor(doctor: { specializations?: string[] }): string {
  const specialization = Array.isArray(doctor.specializations) ? doctor.specializations[0] : undefined
  return specialization || DEFAULT_SERVICE
}

/**
 * Slot occupancy: a CONFIRMED booking always blocks; a PENDING booking blocks
 * while its hold is active. Legacy PENDING rows without a hold remain blocking.
 */
function activeBookingFilter(now: Date) {
  return {
    OR: [
      { status: 'CONFIRMED' as const },
      {
        status: 'PENDING' as const,
        OR: [
          { holdExpiresAt: null },
          { holdExpiresAt: { gt: now } },
        ],
      },
    ],
  }
}

/**
 * Single source of truth for slot availability, optionally scoped to one doctor.
 */
export async function getAvailableSlots(date: string, doctorId?: string, excludeBookingId?: string): Promise<Slot[]> {
  const target = parseDateUTC(date)
  const dayOfWeek = target.getUTCDay()

  if (isHoliday(date)) return []

  const globalBlocked = await prisma.globalBlockedDate.findUnique({
    where: { date: target },
    select: { id: true },
  })
  if (globalBlocked) return []

  const today = new Date()
  const isToday = formatDateISO(today) === date
  const nowMinutes = timeToMinutes(`${pad2(today.getHours())}:${pad2(today.getMinutes())}`)

  const availabilities = await prisma.availability.findMany({
    where: {
      dayOfWeek,
      ...(doctorId ? { doctorId } : {}),
      doctor: { isActive: true, user: { isActive: true } },
    },
    include: {
      doctor: {
        include: { user: true },
      },
    },
  })

  if (availabilities.length === 0) return []

  const bookings = await prisma.booking.findMany({
    where: {
      date: target,
      ...activeBookingFilter(today),
      ...(doctorId ? { doctorId } : {}),
    },
    select: { id: true, doctorId: true, startTime: true, endTime: true },
  })

  const blocked = await prisma.blockedSlot.findMany({
    where: { date: target, ...(doctorId ? { doctorId } : {}) },
    select: { doctorId: true, startTime: true, endTime: true },
  })

  const slots: Slot[] = []

  for (const availability of availabilities) {
    const doctor = availability.doctor
    if (!doctor?.user?.name) continue

    const start = timeToMinutes(availability.startTime)
    const end = timeToMinutes(availability.endTime)
    const duration = availability.sessionDuration
    if (duration <= 0 || end <= start) continue

    const doctorBookings = bookings.filter(
      (b) => b.doctorId === doctor.id && (!excludeBookingId || b.id !== excludeBookingId),
    )
    const doctorBlocked = blocked.filter((b) => b.doctorId === doctor.id)

    for (let slotStart = start; slotStart + duration <= end; slotStart += duration) {
      const slotEnd = slotStart + duration
      if (isToday && slotStart <= nowMinutes) continue

      if (doctorBookings.some((b) => overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), slotStart, slotEnd))) continue
      if (doctorBlocked.some((b) => overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), slotStart, slotEnd))) continue

      slots.push({
        doctorId: doctor.id,
        doctorName: doctor.user.name,
        startTime: `${pad2(Math.floor(slotStart / 60))}:${pad2(slotStart % 60)}`,
        endTime: `${pad2(Math.floor(slotEnd / 60))}:${pad2(slotEnd % 60)}`,
        sessionDuration: duration,
        service: serviceFor(doctor as { specializations?: string[] }),
      })
    }
  }

  slots.sort((a, b) => a.startTime.localeCompare(b.startTime))
  return slots
}

/**
 * Returns every date in a month that has at least one available slot,
 * optionally scoped to one doctor.
 */
export async function getAvailableDates(month: number, year: number, doctorId?: string): Promise<string[]> {
  const availabilities = await prisma.availability.findMany({
    where: {
      ...(doctorId ? { doctorId } : {}),
      doctor: { isActive: true, user: { isActive: true } },
    },
    include: {
      doctor: {
        include: { user: true },
      },
    },
  })

  if (availabilities.length === 0) return []

  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  const today = new Date()

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
      ...(doctorId ? { doctorId } : {}),
      ...activeBookingFilter(today),
    },
    select: { doctorId: true, date: true, startTime: true, endTime: true },
  })

  const blocked = await prisma.blockedSlot.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
      ...(doctorId ? { doctorId } : {}),
    },
    select: { doctorId: true, date: true, startTime: true, endTime: true },
  })

  const globalBlockedDates = await prisma.globalBlockedDate.findMany({
    where: { date: { gte: monthStart, lte: monthEnd } },
    select: { date: true },
  }) ?? []
  const globallyBlocked = new Set(globalBlockedDates.map((b) => formatDateUTC(b.date)))

  const available: string[] = []

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const current = new Date(year, month - 1, day)
    const dateISO = formatDateISO(current)
    const dayOfWeek = current.getDay()
    const isToday = formatDateISO(today) === dateISO

    if (isHoliday(dateISO)) continue
    if (globallyBlocked.has(dateISO)) continue

    const dayAvailabilities = availabilities.filter((a) => a.dayOfWeek === dayOfWeek)
    let hasSlot = false

    for (const availability of dayAvailabilities) {
      const doctor = availability.doctor
      if (!doctor?.user?.name) continue

      const start = timeToMinutes(availability.startTime)
      const end = timeToMinutes(availability.endTime)
      const duration = availability.sessionDuration
      if (duration <= 0 || end <= start) continue

      const doctorBookings = bookings.filter((b) => b.doctorId === doctor.id && formatDateUTC(b.date) === dateISO)
      const doctorBlocked = blocked.filter((b) => b.doctorId === doctor.id && formatDateUTC(b.date) === dateISO)
      const nowMinutes = timeToMinutes(`${pad2(today.getHours())}:${pad2(today.getMinutes())}`)

      for (let slotStart = start; slotStart + duration <= end; slotStart += duration) {
        if (isToday && slotStart <= nowMinutes) continue
        const slotEnd = slotStart + duration
        if (doctorBookings.some((b) => overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), slotStart, slotEnd))) continue
        if (doctorBlocked.some((b) => overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), slotStart, slotEnd))) continue
        hasSlot = true
        break
      }
      if (hasSlot) break
    }

    if (hasSlot) available.push(dateISO)
  }

  return available
}
