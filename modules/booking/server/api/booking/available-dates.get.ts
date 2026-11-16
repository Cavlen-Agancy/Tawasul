import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { getAvailableDates } from '~/server/utils/availability'
import { availableDatesQuerySchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const parsed = availableDatesQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid month, year, or doctor' })
  }

  const doctor = await prisma.doctor.findFirst({
    where: { id: parsed.data.doctorId, isActive: true, user: { isActive: true } },
    select: { id: true },
  })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor not found' })
  }

  const dates = await getAvailableDates(parsed.data.month, parsed.data.year, doctor.id)
  return { dates }
})
