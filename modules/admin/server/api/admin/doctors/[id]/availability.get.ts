import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'DOCTORS', 'READ')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Doctor ID is required' })
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: {
      availability: { orderBy: { dayOfWeek: 'asc' } },
      blockedSlots: { orderBy: { date: 'asc' } },
    },
  })

  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor not found' })
  }

  return {
    availability: doctor.availability,
    blockedSlots: doctor.blockedSlots,
  }
})
