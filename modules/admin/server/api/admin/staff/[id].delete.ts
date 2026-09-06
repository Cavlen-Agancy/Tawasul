import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'STAFF', 'DELETE')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Staff ID is required' })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.accountType !== 'STAFF') {
    throw createError({ statusCode: 404, message: 'Staff member not found' })
  }

  const seedEmail = process.env.SEED_ADMIN_EMAIL
  if (seedEmail && target.email === seedEmail) {
    throw createError({ statusCode: 403, message: 'Cannot deactivate seed admin' })
  }

  await prisma.user.update({ where: { id }, data: { isActive: false } })

  return { success: true }
})
