import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { getAvailableSlots, timeToMinutes } from '~/server/utils/availability'
import { createBookingSchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }
  const { date, startTime, doctorId } = parsed.data

  const availableSlots = await getAvailableSlots(date)
  const slot = availableSlots.find((s) => s.doctorId === doctorId && s.startTime === startTime)
  if (!slot) {
    throw createError({ statusCode: 400, message: 'This slot is no longer available' })
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: {
      availability: {
        where: { dayOfWeek: parseISODay(date) },
      },
    },
  })
  if (!doctor) {
    throw createError({ statusCode: 400, message: 'Doctor not found' })
  }

  const availability = doctor.availability[0]
  if (!availability) {
    throw createError({ statusCode: 400, message: 'Doctor is not available on this date' })
  }

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const currency = 'EGP'
  const sessionPricePerHour = Number(settings?.sessionPricePerHour ?? 0)
  const sessionDuration = availability.sessionDuration

  const startMinutes = timeToMinutes(startTime)
  const endMinutes = startMinutes + sessionDuration
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

  const amount = Math.round((sessionDuration / 60) * sessionPricePerHour * 100) / 100

  const service = slot.service

  const booking = await prisma.booking.create({
    data: {
      userId: auth.userId,
      doctorId,
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

function parseISODay(date: string): number {
  const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
  return new Date(y, m - 1, d).getDay()
}

function parseDateValue(date: string): Date {
  const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
  return new Date(y, m - 1, d)
}
