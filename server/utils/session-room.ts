import { prisma } from '~/server/utils/prisma'
import { scheduleSessionTermination } from './session-termination'

/**
 * Returns the canonical LiveKit room for a booking and keeps its expiry aligned
 * with the appointment end. Access is still enforced by `meeting.ts` on every
 * token request/admission; `SessionRoom.expiresAt` is not authorization by
 * itself.
 *
 * `patientEntryId` is supplied only by the patient token route. Generating a new
 * entry rotates the server-side admission state: the previous entry can no
 * longer be admitted, and the admitted participant SID is cleared so the doctor
 * must admit the new entry.
 *
 * If the appointment end changed (reschedule), the previous termination marker
 * and admission generation are cleared and termination is re-armed for the new
 * end. Both token routes have already validated the new window at this point.
 */
export async function ensureSessionRoom(
  bookingId: string,
  closeAt: number,
  patientEntryId?: string,
) {
  const roomName = `tawasul-${bookingId}`
  const expiresAt = new Date(closeAt)

  const existing = await prisma.sessionRoom.findUnique({
    where: { bookingId },
    select: { expiresAt: true },
  })
  const appointmentChanged = !!existing && existing.expiresAt.getTime() !== expiresAt.getTime()

  const room = await prisma.sessionRoom.upsert({
    where: { bookingId },
    create: {
      bookingId,
      roomName,
      expiresAt,
      currentEntryId: patientEntryId ?? null,
      admittedParticipantSid: null,
    },
    update: {
      expiresAt,
      ...(appointmentChanged
        ? {
            terminatedAt: null,
            admittedParticipantSid: null,
            currentEntryId: patientEntryId ?? null,
          }
        : {}),
      ...(patientEntryId
        ? { currentEntryId: patientEntryId, admittedParticipantSid: null }
        : {}),
    },
  })

  scheduleSessionTermination(room.bookingId, room.roomName, closeAt)
  return room
}
