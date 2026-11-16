import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { getAvailableSlots, parseDateUTC, timeToMinutes } from '~/server/utils/availability'
import { createBookingSchema } from '~/server/utils/validation'
import { sendEmail, bookingConfirmationTemplate } from '~/server/utils/email'

/** Online holds are server-controlled; never accept a client-supplied duration. */
function bookingHoldMinutes(): number {
  const parsed = Number(process.env.BOOKING_HOLD_MINUTES ?? 20)
  if (!Number.isFinite(parsed)) return 20
  return Math.min(60, Math.max(5, Math.floor(parsed)))
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }
  const { doctorId, date, startTime, sessionType } = parsed.data

  const doctor = await prisma.doctor.findFirst({
    where: { id: doctorId, isActive: true, user: { isActive: true } },
    include: { user: { select: { name: true, email: true } } },
  })
  if (!doctor) {
    throw createError({ statusCode: 400, message: 'Doctor is not available' })
  }

  const patient = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true, email: true },
  })
  if (!patient) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const currency = 'EGP'
  const sessionPricePerHour = Number(settings?.sessionPricePerHour ?? 0)

  const lockKey = `${doctorId}|${date}|${startTime}`
  const created = await prisma.$transaction(async (tx) => {
    // Serialize only the same doctor/date/time, not the entire booking table.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}), 0)`

    const availableSlots = await getAvailableSlots(date, doctorId)
    const slot = availableSlots.find((s) => s.startTime === startTime)
    if (!slot) {
      throw createError({ statusCode: 400, message: 'This slot is no longer available' })
    }

    const startMinutes = timeToMinutes(startTime)
    const endMinutes = startMinutes + slot.sessionDuration
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

    const amount = Math.round((slot.sessionDuration / 60) * sessionPricePerHour * 100) / 100
    const isInClinic = sessionType === 'IN_CLINIC'

    const booking = await tx.booking.create({
      data: {
        userId: auth.userId,
        doctorId,
        date: parseDateUTC(date),
        startTime,
        endTime,
        service: slot.service,
        status: isInClinic ? 'CONFIRMED' : 'PENDING',
        sessionType,
        holdExpiresAt: isInClinic ? null : new Date(Date.now() + bookingHoldMinutes() * 60 * 1000),
      },
    })

    if (!isInClinic) {
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount,
          currency,
          status: 'PENDING',
        },
      })
    }

    return { booking, amount }
  })

  if (sessionType === 'IN_CLINIC') {
    await sendInClinicConfirmation({
      patientName: patient.name,
      patientEmail: patient.email,
      doctorName: doctor.user.name,
      doctorEmail: doctor.user.email,
      date: created.booking.date,
      startTime,
      endTime: created.booking.endTime,
      service: created.booking.service,
    })
  }

  setResponseStatus(event, 201)
  return {
    bookingId: created.booking.id,
    doctorId,
    amount: sessionType === 'IN_CLINIC' ? 0 : created.amount,
    currency,
    sessionType,
  }
})

async function sendInClinicConfirmation(input: {
  patientName: string
  patientEmail: string
  doctorName: string
  doctorEmail: string
  date: Date
  startTime: string
  endTime: string
  service: string
}): Promise<void> {
  const dateLabel = input.date.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const timeLabel = `${input.startTime} – ${input.endTime}`

  try {
    await sendEmail({
      to: input.patientEmail,
      subject: 'Your session is confirmed — Tawasul Academy',
      html: bookingConfirmationTemplate(input.patientName, input.doctorName, dateLabel, timeLabel, input.service),
    })
  } catch (error) {
    console.error('[booking] In-clinic patient confirmation email failed:', error)
  }

  try {
    await sendEmail({
      to: input.doctorEmail,
      subject: 'New confirmed appointment — Tawasul Academy',
      html: bookingConfirmationTemplate(input.doctorName, input.patientName, dateLabel, timeLabel, input.service),
    })
  } catch (error) {
    console.error('[booking] In-clinic doctor confirmation email failed:', error)
  }
}
