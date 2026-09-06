import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { availabilityReplaceSchema, validationMessage } from '~/server/utils/validation'
import { timeToMinutes } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'DOCTORS', 'UPDATE')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Doctor ID is required' })
  }

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = availabilityReplaceSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }

  const doctor = await prisma.doctor.findUnique({ where: { id } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor not found' })
  }

  const seen = new Set<number>()
  for (const slot of parsed.data.availability) {
    if (seen.has(slot.dayOfWeek)) {
      throw createError({ statusCode: 400, message: 'Duplicate day in availability' })
    }
    seen.add(slot.dayOfWeek)
    if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
      throw createError({ statusCode: 400, message: 'startTime must be before endTime' })
    }
  }

  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { doctorId: id } }),
    prisma.availability.createMany({
      data: parsed.data.availability.map((slot) => ({
        doctorId: id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        sessionDuration: slot.sessionDuration,
      })),
    }),
  ])

  const availability = await prisma.availability.findMany({
    where: { doctorId: id },
    orderBy: { dayOfWeek: 'asc' },
  })

  return { success: true, availability }
})
