import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'SETTINGS', 'UPDATE')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Blocked date ID is required' })
  }

  const existing = await prisma.globalBlockedDate.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Blocked date not found' })
  }

  await prisma.globalBlockedDate.delete({ where: { id } })

  return { ok: true }
})