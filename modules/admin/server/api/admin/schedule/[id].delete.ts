import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'SETTINGS', 'UPDATE')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Schedule ID is required' })
  }

  const existing = await prisma.adminSchedule.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Schedule not found' })
  }

  await prisma.adminSchedule.delete({ where: { id } })

  return { ok: true }
})