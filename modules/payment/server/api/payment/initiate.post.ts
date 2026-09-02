import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { initiatePaymentSchema } from '~/server/utils/validation'
import { createPaymentSession } from '~/server/utils/payment'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = initiatePaymentSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: { payment: true },
  })

  if (!booking) {
    throw createError({ statusCode: 400, message: 'Booking not found' })
  }

  if (booking.userId !== auth.userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  if (booking.status === 'CONFIRMED') {
    throw createError({ statusCode: 400, message: 'Booking already confirmed' })
  }

  if (!booking.payment) {
    throw createError({ statusCode: 400, message: 'Payment not found for this booking' })
  }

  try {
    return await createPaymentSession({
      bookingId: booking.id,
      amount: Number(booking.payment.amount),
      currency: booking.payment.currency,
    })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'Payment gateway error'
    throw createError({ statusCode: 500, message })
  }
})
