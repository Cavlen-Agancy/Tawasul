import { createError } from 'h3'
import type { AuthUser } from '~/server/utils/auth'
import { meetingWindow } from '~/server/utils/meeting'
import { SESSION_JOIN_TEST_TTL_SECONDS, type SessionJoinMode } from '~/lib/session-join'
import { assertSessionJoinAllowed } from '~/server/utils/session-join-mode'

export interface SessionBookingAccessShape {
  userId: string
  doctorId: string | null
  status: string
  sessionType: string
  date: Date
  startTime: string
  endTime: string
}

export interface SessionDoctorAccessShape {
  id: string
  isActive: boolean
  user: {
    isActive: boolean
  }
}

/**
 * Only confirmed online bookings have a video session. In-clinic bookings are
 * valid appointments but intentionally have no LiveKit room.
 */
export function assertOnlineConfirmedBooking(booking: SessionBookingAccessShape): void {
  if (booking.status !== 'CONFIRMED') {
    throw createError({ statusCode: 403, message: 'Session is not available' })
  }
  if (booking.sessionType !== 'ONLINE') {
    throw createError({ statusCode: 400, message: 'This is an in-clinic session.' })
  }
}

/** Patient ownership + active account. */
export function assertPatientSessionOwner(
  auth: AuthUser,
  booking: SessionBookingAccessShape,
  patientIsActive: boolean,
): void {
  if (booking.userId !== auth.userId || !patientIsActive) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
}

/** Doctor ownership + active doctor/user account. */
export function assertDoctorSessionOwner(
  doctor: SessionDoctorAccessShape,
  booking: SessionBookingAccessShape,
): void {
  if (!doctor.isActive || !doctor.user.isActive || booking.doctorId !== doctor.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
}

/**
 * Canonical join gate. Returns the effective mode so callers can choose the
 * token lifetime / room expiry without re-reading the setting.
 */
export function assertSessionWindow(
  booking: Pick<SessionBookingAccessShape, 'date' | 'startTime' | 'endTime'>,
  nowMs = Date.now(),
): Promise<SessionJoinMode> {
  return assertSessionJoinAllowed(booking, nowMs)
}

/**
 * Token lifetime. PRODUCTION never outlives the appointment end; TEST uses a
 * fixed safe lifetime because there is no wall-clock cut-off in that mode.
 */
export function sessionTokenTtlSeconds(
  booking: Pick<SessionBookingAccessShape, 'date' | 'startTime' | 'endTime'>,
  nowMs = Date.now(),
  mode: SessionJoinMode = 'PRODUCTION',
): number {
  if (mode === 'TEST') return SESSION_JOIN_TEST_TTL_SECONDS
  const { closeAt } = meetingWindow(booking)
  const remaining = Math.floor((closeAt - nowMs) / 1000)
  if (remaining < 1) {
    throw createError({ statusCode: 403, message: 'Session has ended' })
  }
  return remaining
}

/**
 * Each patient token carries a per-entry identity. Rotating this entry on every
 * lobby entry invalidates the previous admission generation server-side.
 */
export function buildSessionParticipantIdentity(userId: string, entryId: string): string {
  return `${userId}:${entryId}`
}

export function parseSessionParticipantIdentity(
  identity: string,
): { userId: string; entryId: string } | null {
  const separator = identity.lastIndexOf(':')
  if (separator <= 0 || separator === identity.length - 1) return null
  return {
    userId: identity.slice(0, separator),
    entryId: identity.slice(separator + 1),
  }
}

/** The doctor may admit only the current entry of the booking patient. */
export function assertAdmittedParticipantIdentity(
  booking: Pick<SessionBookingAccessShape, 'userId'>,
  identity: string,
  currentEntryId: string | null,
): void {
  const parsed = parseSessionParticipantIdentity(identity)
  if (!parsed || parsed.userId !== booking.userId || !currentEntryId || parsed.entryId !== currentEntryId) {
    throw createError({ statusCode: 403, message: 'Participant does not match the current booking entry' })
  }
}

export function sessionWindowCloseAt(
  booking: Pick<SessionBookingAccessShape, 'date' | 'startTime' | 'endTime'>,
): number {
  return meetingWindow(booking).closeAt
}
