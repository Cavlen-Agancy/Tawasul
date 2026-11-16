/**
 * Canonical, client-safe session join rules.
 *
 * This module is pure (no Prisma, no h3) so the server session endpoints, the
 * meeting lobby, and the patient/doctor Join Session buttons all use the SAME
 * window and mode logic. Server callers resolve the persisted mode with
 * `~/server/utils/session-join-mode` and pass it in.
 */

export const SESSION_JOIN_MODES = ['PRODUCTION', 'TEST'] as const
export type SessionJoinMode = (typeof SESSION_JOIN_MODES)[number]

export const DEFAULT_SESSION_JOIN_MODE: SessionJoinMode = 'PRODUCTION'
/** TEST mode tokens use the LiveKit default lifetime; no wall-clock cut-off. */
export const SESSION_JOIN_TEST_TTL_SECONDS = 3600
export const MEETING_OPEN_EARLY_MIN = 5

/** Anything other than the explicit TEST value is treated as PRODUCTION. */
export function normalizeSessionJoinMode(value: unknown): SessionJoinMode {
  return value === 'TEST' ? 'TEST' : DEFAULT_SESSION_JOIN_MODE
}

export interface SessionJoinBooking {
  /** Prisma `@db.Date` readback (Date at UTC midnight) or a local `YYYY-MM-DD` string. */
  date: Date | string
  startTime: string
  endTime: string
}

export interface MeetingWindow {
  openAt: number
  closeAt: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Formats a `@db.Date` readback using UTC components (round-trips the stored day). */
function formatUtcDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** Parses a `YYYY-MM-DD` calendar day into a local-midnight Date. */
function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
  return new Date(y, (m || 1) - 1, d || 1)
}

/**
 * Opens 5 minutes before the scheduled start and closes at the EXACT
 * appointment end (no grace period). Used by every join-eligibility caller.
 */
export function meetingWindowFor(booking: SessionJoinBooking): MeetingWindow {
  const dateISO = typeof booking.date === 'string' ? booking.date : formatUtcDate(booking.date)
  const sessionStart = parseLocalDate(dateISO)
  const [sh, sm] = booking.startTime.split(':').map((p) => parseInt(p, 10))
  const [eh, em] = booking.endTime.split(':').map((p) => parseInt(p, 10))
  sessionStart.setHours(sh || 0, sm || 0, 0, 0)
  const sessionEnd = new Date(sessionStart)
  sessionEnd.setHours(eh || 0, em || 0, 0, 0)

  return {
    openAt: sessionStart.getTime() - MEETING_OPEN_EARLY_MIN * 60 * 1000,
    closeAt: sessionEnd.getTime(),
  }
}

/**
 * The single join-time decision.
 * PRODUCTION obeys the 5-minute-early / exact-end window; TEST skips only the
 * clock check. Ownership, status, identity and admission checks live elsewhere
 * and are never relaxed by this mode.
 */
export function canJoinSessionAt(
  booking: SessionJoinBooking,
  nowMs: number,
  mode: SessionJoinMode,
): boolean {
  if (mode === 'TEST') return true
  const { openAt, closeAt } = meetingWindowFor(booking)
  return nowMs >= openAt && nowMs < closeAt
}

/** PRODUCTION-mode reason shown when a join action is unavailable. */
export function joinWindowMessage(booking: SessionJoinBooking, nowMs: number): string | undefined {
  const { closeAt } = meetingWindowFor(booking)
  if (nowMs >= closeAt) return 'Session has ended'
  return `Available ${MEETING_OPEN_EARLY_MIN} minutes before your session`
}
