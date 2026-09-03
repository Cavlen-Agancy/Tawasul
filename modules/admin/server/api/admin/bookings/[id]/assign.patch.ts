import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { assignDoctorSchema } from '~/server/utils/validation'
import { sendEmail, bookingConfirmationTemplate } from '~/server/utils/email'
import { timeToMinutes, formatBookingDateLabel } from '~/server/utils/availability'

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'APPOINTMENTS', 'UPDATE')

  const bookingId = getRouterParam(event, 'id')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = assignDoctorSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }
  const { doctorId } = parsed.data

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: { select: { name: true, email: true } } },
  })
  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }
  if (booking.status !== 'PENDING') {
    throw createError({ statusCode: 400, message: 'Only PENDING bookings can be assigned' })
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { user: { select: { name: true, email: true } } },
  })
  if (!doctor || !doctor.isActive) {
    throw createError({ statusCode: 400, message: 'Doctor not found or inactive' })
  }

  const bookingStart = timeToMinutes(booking.startTime)
  const bookingEnd = timeToMinutes(booking.endTime)

  const doctorBookings = await prisma.booking.findMany({
    where: {
      doctorId,
      date: booking.date,
      status: 'CONFIRMED',
    },
    select: { startTime: true, endTime: true },
  })

  const conflicting = doctorBookings.some((b) =>
    overlaps(bookingStart, bookingEnd, timeToMinutes(b.startTime), timeToMinutes(b.endTime)),
  )
  if (conflicting) {
    throw createError({ statusCode: 400, message: 'Doctor already has a booking at this time' })
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { doctorId, status: 'CONFIRMED' },
  })

  const dateLabel = formatBookingDateLabel(booking.date)
  const timeLabel = `${booking.startTime} – ${booking.endTime}`
  const doctorName = doctor.user.name

  try {
    await sendEmail({
      to: booking.user.email,
      subject: 'Your session is confirmed — Tawasul Academy',
      html: bookingConfirmationTemplate(booking.user.name, doctorName, dateLabel, timeLabel, booking.service),
    })
  } catch (error) {
    console.error('[admin] Assignment confirmation email to patient failed:', error)
  }

  try {
    await sendEmail({
      to: doctor.user.email,
      subject: 'New confirmed session — Tawasul Academy',
      html: bookingConfirmationTemplate(booking.user.name, doctorName, dateLabel, timeLabel, booking.service),
    })
  } catch (error) {
    console.error('[admin] Assignment notification email to doctor failed:', error)
  }

  return {
    booking: {
      id: updated.id,
      doctorId: updated.doctorId,
      status: updated.status,
    },
  }
})