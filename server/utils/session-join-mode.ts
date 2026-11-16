import { createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import {
  DEFAULT_SESSION_JOIN_MODE,
  canJoinSessionAt,
  meetingWindowFor,
  normalizeSessionJoinMode,
  type SessionJoinBooking,
  type SessionJoinMode,
} from '~/lib/session-join'

/**
 * Reads the persisted admin setting. Any missing/invalid value (including a
 * database error before the migration is applied) falls back to PRODUCTION —
 * never to TEST.
 */
export async function getSessionJoinMode(): Promise<SessionJoinMode> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { sessionJoinMode: true },
    })
    return normalizeSessionJoinMode(settings?.sessionJoinMode)
  } catch {
    return DEFAULT_SESSION_JOIN_MODE
  }
}

/**
 * Canonical server-side join gate used by patient, doctor and lobby endpoints.
 * Only the clock check changes in TEST mode — authentication, booking
 * ownership, CONFIRMED/ONLINE checks, participant identity and doctor
 * admission are enforced separately and remain intact.
 */
export async function assertSessionJoinAllowed(
  booking: SessionJoinBooking,
  nowMs = Date.now(),
): Promise<SessionJoinMode> {
  const mode = await getSessionJoinMode()
  if (canJoinSessionAt(booking, nowMs, mode)) return mode

  const { closeAt } = meetingWindowFor(booking)
  if (nowMs >= closeAt) {
    throw createError({ statusCode: 403, message: 'Session has ended' })
  }
  throw createError({ statusCode: 403, message: 'Session is not available at this time' })
}
