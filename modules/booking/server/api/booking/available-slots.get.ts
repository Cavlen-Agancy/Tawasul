import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { getAvailableSlots } from '~/server/utils/availability'
import { availableSlotsQuerySchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const parsed = availableSlotsQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid date or doctor' })
  }

  const doctor = await prisma.doctor.findFirst({
    where: { id: parsed.data.doctorId, isActive: true, user: { isActive: true } },
    select: { id: true },
  })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor not found' })
  }

  const slots = await getAvailableSlots(parsed.data.date, doctor.id)
  return { slots }
})
