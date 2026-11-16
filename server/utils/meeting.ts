import {
  canJoinSessionAt,
  meetingWindowFor,
  type MeetingWindow,
  type SessionJoinBooking,
  type SessionJoinMode,
} from '~/lib/session-join'

export { MEETING_OPEN_EARLY_MIN } from '~/lib/session-join'

/**
 * Kept as a compatibility export for callers/tests that imported it. Session
 * access closes exactly at the appointment end, so there is no late grace.
 */
export const MEETING_CLOSE_LATE_MIN = 0

export type { MeetingWindow }

/**
 * Server-facing wrapper around the canonical (client-safe) window helper.
 * Booking.date is a Prisma `@db.Date` readback (UTC midnight) and is converted
 * to the stored calendar day inside `meetingWindowFor`.
 */
export function meetingWindow(booking: SessionJoinBooking): MeetingWindow {
  return meetingWindowFor(booking)
}

/**
 * Backwards-compatible predicate. Mode-aware callers should use
 * `canJoinSessionAt` with the persisted mode instead; the default keeps the
 * historical PRODUCTION behaviour for existing callers and tests.
 */
export function canJoinMeetingAt(booking: SessionJoinBooking, nowMs: number, mode: SessionJoinMode = 'PRODUCTION'): boolean {
  return canJoinSessionAt(booking, nowMs, mode)
}
