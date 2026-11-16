import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { formatDateUTC, getAvailableSlots, timeToMinutes } from '~/server/utils/availability'
import { isHoliday } from '~/server/utils/holidays'
import { z } from 'zod'

const updateBookingSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format'),
})

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return bStart < aEnd && bEnd > aStart
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = updateBookingSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }
  const { startTime } = parsed.data

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { payment: true },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  // Patients may only edit their own bookings; admins/staff reassign via the admin UI.
  if (booking.userId !== auth.userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  if (booking.status === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Booking is already cancelled' })
  }

  const dateStr = formatDateUTC(booking.date)

  // Holidays and globally blocked dates cannot be rescheduled onto.
  if (isHoliday(dateStr)) {
    throw createError({ statusCode: 400, message: 'The clinic is closed on this day' })
  }

  // New/transitional bookings are doctor-specific. Legacy unassigned rows are
  // left for admin remediation rather than silently rescheduled without a doctor.
  if (!booking.doctorId) {
    throw createError({ statusCode: 400, message: 'This booking needs admin assistance' })
  }

  // Re-validate the new slot against the booked doctor's schedule and blocks.
  const availableSlots = await getAvailableSlots(dateStr, booking.doctorId, booking.id)
  const slot = availableSlots.find((s) => s.startTime === startTime)
  if (!slot) {
    throw createError({ statusCode: 400, message: 'This slot is no longer available' })
  }

  // Ensure no OTHER non-cancelled booking occupies the target slot on that date.
  // The patient's own booking is excluded so they may keep (or switch to) an
  // overlapping slot.
  const sessionDuration = slot.sessionDuration
  const newStart = timeToMinutes(startTime)
  const newEnd = newStart + sessionDuration

  const now = new Date()
  const competing = await prisma.booking.findMany({
    where: {
      date: booking.date,
      id: { not: id },
      OR: [
        { status: 'CONFIRMED' },
        {
          status: 'PENDING',
          OR: [
            { holdExpiresAt: null },
            { holdExpiresAt: { gt: now } },
          ],
        },
      ],
    },
    select: { startTime: true, endTime: true },
  })
  const conflict = competing.some((b) =>
    overlaps(timeToMinutes(b.startTime), timeToMinutes(b.endTime), newStart, newEnd),
  )
  if (conflict) {
    throw createError({ statusCode: 400, message: 'This slot is no longer available' })
  }

  const endTime = `${String(Math.floor(newEnd / 60)).padStart(2, '0')}:${String(newEnd % 60).padStart(2, '0')}`

  const updated = await prisma.booking.update({
    where: { id },
    data: { startTime, endTime },
    include: {
      doctor: { include: { user: { select: { name: true, photo: true } } } },
      sessionRoom: { select: { roomName: true } },
    },
  })

  return {
    id: updated.id,
    doctorId: updated.doctorId,
    doctorName: updated.doctor?.user?.name ?? 'Unknown Doctor',
    doctorPhoto: updated.doctor?.user?.photo ?? undefined,
    date: dateStr,
    startTime: updated.startTime,
    endTime: updated.endTime,
    service: updated.service,
    status: updated.status,
    sessionRoom: updated.sessionRoom ? { roomName: updated.sessionRoom.roomName } : undefined,
  }
})
