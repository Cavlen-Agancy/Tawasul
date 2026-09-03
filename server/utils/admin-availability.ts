import { prisma } from '~/server/utils/prisma'
import { isHoliday } from '~/server/utils/holidays'

export interface AdminSlot {
  startTime: string
  endTime: string
  sessionDuration: number
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
 * Parses "YYYY-MM-DD" into a local Date at midnight.
 */
export function parseISODate(date: string): Date {
  const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
  return new Date(y, m - 1, d)
}

/**
 * Checks whether a slot [slotStart, slotEnd) overlaps another window [aStart, aEnd).
 */
function overlaps(aStart: number, aEnd: number, slotStart: number, slotEnd: number): boolean {
  return slotStart < aEnd && slotEnd > aStart
}

/**
 * Single source of truth for which patient-facing slots are available on a given date.
 * Reads from the global AdminSchedule (not doctor Availability) and GlobalBlockedDate.
 * Slots carry NO doctorId — a doctor is assigned later by the admin.
 */
export async function getAdminAvailableSlots(date: string): Promise<AdminSlot[]> {
  const target = parseISODate(date)
  const today = new Date()
  const todayISO = formatDateISO(today)

  // Past dates have no slots.
  if (date < todayISO) return []

  const isToday = date === todayISO

  // Globally blocked dates have no slots.
  const blockedDate = await prisma.globalBlockedDate.findUnique({
    where: { date: target },
    select: { id: true },
  })
  if (blockedDate) return []

  // Public holidays are non-working days regardless of the schedule.
  if (isHoliday(date)) return []

  const dayOfWeek = target.getDay()

  const schedules = await prisma.adminSchedule.findMany({
    where: { dayOfWeek, isActive: true },
  })

  const slots: AdminSlot[] = []

  // Count CONFIRMED bookings on this date (globally — the admin schedule is shared).
  const bookings = await prisma.booking.findMany({
    where: { date: target, status: 'CONFIRMED' },
    select: { startTime: true, endTime: true },
  })

  const nowMinutes = timeToMinutes(`${pad2(today.getHours())}:${pad2(today.getMinutes())}`)

  for (const schedule of schedules) {
    const start = timeToMinutes(schedule.startTime)
    const end = timeToMinutes(schedule.endTime)
    const duration = schedule.sessionDuration

    if (duration <= 0 || end <= start) continue

    for (let slotStart = start; slotStart + duration <= end; slotStart += duration) {
      const slotEnd = slotStart + duration

      if (isToday && slotStart <= nowMinutes) continue

      const taken = bookings.some((b) => overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), slotStart, slotEnd))
      if (taken) continue

      slots.push({
        startTime: `${pad2(Math.floor(slotStart / 60))}:${pad2(slotStart % 60)}`,
        endTime: `${pad2(Math.floor(slotEnd / 60))}:${pad2(slotEnd % 60)}`,
        sessionDuration: duration,
      })
    }
  }

  slots.sort((a, b) => a.startTime.localeCompare(b.startTime))
  return slots
}

/**
 * Returns every date in a month that has at least one available slot.
 * Day-level past dates are intentionally NOT skipped here; consumers rely on
 * getAdminAvailableSlots returning [] for past dates.
 */
export async function getAdminAvailableDates(month: number, year: number): Promise<string[]> {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

  const schedules = await prisma.adminSchedule.findMany({
    where: { isActive: true },
  })
  if (schedules.length === 0) return []

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

  const blockedDates = await prisma.globalBlockedDate.findMany({
    where: { date: { gte: monthStart, lte: monthEnd } },
    select: { date: true },
  })
  const blockedSet = new Set(blockedDates.map((b) => formatDateISO(b.date)))

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
      status: 'CONFIRMED',
    },
    select: { date: true, startTime: true, endTime: true },
  })

  const available: string[] = []

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const current = new Date(year, month - 1, day)
    const dateISO = formatDateISO(current)

    // Holidays and globally blocked dates are never available.
    if (isHoliday(dateISO)) continue
    if (blockedSet.has(dateISO)) continue

    const dayOfWeek = current.getDay()
    const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek)
    if (daySchedules.length === 0) continue

    const dayBookings = bookings.filter((b) => formatDateISO(b.date) === dateISO)

    let hasSlot = false
    for (const schedule of daySchedules) {
      const start = timeToMinutes(schedule.startTime)
      const end = timeToMinutes(schedule.endTime)
      const duration = schedule.sessionDuration
      if (duration <= 0 || end <= start) continue

      for (let slotStart = start; slotStart + duration <= end; slotStart += duration) {
        const slotEnd = slotStart + duration
        const taken = dayBookings.some((b) => overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), slotStart, slotEnd))
        if (!taken) {
          hasSlot = true
          break
        }
      }
      if (hasSlot) break
    }

    if (hasSlot) available.push(dateISO)
  }

  return available
}

export function serviceFor(): string {
  return DEFAULT_SERVICE
}