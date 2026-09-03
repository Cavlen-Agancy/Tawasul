import { parseISODate, formatDateISO } from '~/server/utils/availability'

export const MEETING_OPEN_EARLY_MIN = 5
export const MEETING_CLOSE_LATE_MIN = 15

export type MeetingWindow = {
  openAt: number
  closeAt: number
}

/**
 * Shared meeting window rule: a meeting may be joined from OPEN_EARLY_MIN
 * minutes before its start time until CLOSE_LATE_MIN minutes after its end time.
 *
 * Booking.date is stored as Prisma `@db.Date` (a local-midnight Date). We derive
 * the intended calendar day with `formatDateISO` (local time) and rebuild the
 * start/end instants in the server's local timezone. This avoids the off-by-one
 * that `date.toISOString().slice(0, 10)` introduced (UTC day vs local day).
 */
export function meetingWindow(booking: { date: Date; startTime: string; endTime: string }): MeetingWindow {
  const dateISO = formatDateISO(booking.date)
  const sessionStart = parseISODate(dateISO)
  const [sh, sm] = booking.startTime.split(':').map((p) => parseInt(p, 10))
  const [eh, em] = booking.endTime.split(':').map((p) => parseInt(p, 10))
  sessionStart.setHours(sh || 0, sm || 0, 0, 0)
  const sessionEnd = new Date(sessionStart)
  sessionEnd.setHours(eh || 0, em || 0, 0, 0)

  const openAt = sessionStart.getTime() - MEETING_OPEN_EARLY_MIN * 60 * 1000
  const closeAt = sessionEnd.getTime() + MEETING_CLOSE_LATE_MIN * 60 * 1000
  return { openAt, closeAt }
}

/**
 * Whether a meeting can be joined at the given instant (ms epoch).
 */
export function canJoinMeetingAt(booking: { date: Date; startTime: string; endTime: string }, nowMs: number): boolean {
  const { openAt, closeAt } = meetingWindow(booking)
  return nowMs >= openAt && nowMs <= closeAt
}