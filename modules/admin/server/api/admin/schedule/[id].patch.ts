import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { scheduleUpdateSchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'SETTINGS', 'UPDATE')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Schedule ID is required' })
  }

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = scheduleUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  if (parsed.data.startTime && parsed.data.endTime && parsed.data.startTime >= parsed.data.endTime) {
    throw createError({ statusCode: 400, message: 'startTime must be before endTime' })
  }

  const existing = await prisma.adminSchedule.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Schedule not found' })
  }

  const schedule = await prisma.adminSchedule.update({
    where: { id },
    data: parsed.data,
  })

  return { schedule }
})