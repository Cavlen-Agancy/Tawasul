import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { getAdminAvailableSlots, serviceFor } from '~/server/utils/admin-availability'
import { timeToMinutes } from '~/server/utils/availability'
import { createBookingSchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }
  const { date, startTime } = parsed.data

  // Re-validate the slot is still available (single source of truth).
  const availableSlots = await getAdminAvailableSlots(date)
  const slot = availableSlots.find((s) => s.startTime === startTime)
  if (!slot) {
    throw createError({ statusCode: 400, message: 'This slot is no longer available' })
  }

  const sessionDuration = slot.sessionDuration

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const currency = 'EGP'
  const sessionPricePerHour = Number(settings?.sessionPricePerHour ?? 0)

  const startMinutes = timeToMinutes(startTime)
  const endMinutes = startMinutes + sessionDuration
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

  const amount = Math.round((sessionDuration / 60) * sessionPricePerHour * 100) / 100

  const service = serviceFor()

  // The booking is created WITHOUT a doctor and stays PENDING until an admin assigns one (Phase 6).
  const booking = await prisma.booking.create({
    data: {
      userId: auth.userId,
      doctorId: null,
      date: parseDateValue(date),
      startTime,
      endTime,
      service,
      status: 'PENDING',
    },
  })

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      amount,
      currency,
      status: 'PENDING',
    },
  })

  setResponseStatus(event, 201)
  return {
    bookingId: booking.id,
    amount,
    currency,
  }
})

function parseDateValue(date: string): Date {
  const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
  // Booking.date is `@db.Date` (bare calendar day). Store at UTC midnight so
  // the intended day round-trips exactly in every server timezone. A local
  // `new Date(y, m - 1, d)` stored the PREVIOUS day on UTC+X servers.
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
}