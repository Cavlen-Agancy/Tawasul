import { prisma } from '~/server/utils/prisma'
import { isHoliday } from '~/server/utils/holidays'

export interface Slot {
  doctorId: string
  doctorName: string
  startTime: string
  endTime: string
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
 * Single source of truth for slot availability across all active doctors on a given date.
 */
export async function getAvailableSlots(date: string): Promise<Slot[]> {
  const target = parseISODate(date)
  const dayOfWeek = target.getDay()

  // Public holidays are non-working days (see holidays.ts business rule):
  // no slots are offered regardless of standing doctor availability.
  if (isHoliday(date)) return []

  const today = new Date()
  const isToday = formatDateISO(today) === date

  const availabilities = await prisma.availability.findMany({
    where: {
      dayOfWeek,
      doctor: { isActive: true },
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
      status: 'CONFIRMED',
    },
    select: { doctorId: true, startTime: true, endTime: true },
  })

  const blocked = await prisma.blockedSlot.findMany({
    where: { date: target },
    select: { doctorId: true, startTime: true, endTime: true },
  })

  const nowMinutes = timeToMinutes(`${pad2(today.getHours())}:${pad2(today.getMinutes())}`)

  const slots: Slot[] = []

  for (const availability of availabilities) {
    const doctor = availability.doctor
    if (!doctor?.user?.name) continue

    const start = timeToMinutes(availability.startTime)
    const end = timeToMinutes(availability.endTime)
    const duration = availability.sessionDuration

    if (duration <= 0 || end <= start) continue

    const doctorBookings = bookings.filter((b) => b.doctorId === doctor.id)
    const doctorBlocked = blocked.filter((b) => b.doctorId === doctor.id)

    for (let slotStart = start; slotStart + duration <= end; slotStart += duration) {
      const slotEnd = slotStart + duration

      if (isToday && slotStart <= nowMinutes) continue

      const booked = doctorBookings.some((b) => overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), slotStart, slotEnd))
      if (booked) continue

      const isBlocked = doctorBlocked.some((b) => overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), slotStart, slotEnd))
      if (isBlocked) continue

      slots.push({
        doctorId: doctor.id,
        doctorName: doctor.user.name,
        startTime: `${pad2(Math.floor(slotStart / 60))}:${pad2(slotStart % 60)}`,
        endTime: `${pad2(Math.floor(slotEnd / 60))}:${pad2(slotEnd % 60)}`,
        service: serviceFor(doctor as { specializations?: string[] }),
      })
    }
  }

  slots.sort((a, b) => a.startTime.localeCompare(b.startTime))
  return slots
}

/**
 * Returns every date in a month that has at least one available slot.
 */
export async function getAvailableDates(month: number, year: number): Promise<string[]> {
  const availabilities = await prisma.availability.findMany({
    where: {
      doctor: { isActive: true },
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

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
      status: 'CONFIRMED',
    },
    select: { doctorId: true, date: true, startTime: true, endTime: true },
  })

  const blocked = await prisma.blockedSlot.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
    },
    select: { doctorId: true, date: true, startTime: true, endTime: true },
  })

  const today = new Date()

  const available: string[] = []

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const current = new Date(year, month - 1, day)
    const dateISO = formatDateISO(current)
    const dayOfWeek = current.getDay()
    const isToday = formatDateISO(today) === dateISO

    // Holidays are non-working: never report them as available.
    if (isHoliday(dateISO)) continue

    const dayAvailabilities = availabilities.filter((a) => a.dayOfWeek === dayOfWeek)

    let hasSlot = false

    for (const availability of dayAvailabilities) {
      const doctor = availability.doctor
      if (!doctor?.user?.name) continue

      const start = timeToMinutes(availability.startTime)
      const end = timeToMinutes(availability.endTime)
      const duration = availability.sessionDuration

      if (duration <= 0 || end <= start) continue

      const doctorBookings = bookings.filter((b) => b.doctorId === doctor.id && formatDateISO(b.date) === dateISO)
      const doctorBlocked = blocked.filter((b) => b.doctorId === doctor.id && formatDateISO(b.date) === dateISO)

      const nowMinutes = timeToMinutes(`${pad2(today.getHours())}:${pad2(today.getMinutes())}`)

      for (let slotStart = start; slotStart + duration <= end; slotStart += duration) {
        if (isToday && slotStart <= nowMinutes) continue
        const slotEnd = slotStart + duration
        const booked = doctorBookings.some((b) => overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), slotStart, slotEnd))
        if (booked) continue
        const isBlocked = doctorBlocked.some((b) => overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), slotStart, slotEnd))
        if (isBlocked) continue
        hasSlot = true
        break
      }
      if (hasSlot) break
    }

    if (hasSlot) available.push(dateISO)
  }

  return available
}
