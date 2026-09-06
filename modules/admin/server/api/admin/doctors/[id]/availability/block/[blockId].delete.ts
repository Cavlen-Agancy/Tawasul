import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'DOCTORS', 'UPDATE')

  const id = getRouterParam(event, 'id')
  const blockId = getRouterParam(event, 'blockId')
  if (!id || !blockId) {
    throw createError({ statusCode: 400, message: 'Doctor ID and block ID are required' })
  }

  const block = await prisma.blockedSlot.findUnique({ where: { id: blockId } })
  if (!block) {
    throw createError({ statusCode: 404, message: 'Blocked slot not found' })
  }

  if (block.doctorId !== id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  await prisma.blockedSlot.delete({ where: { id: blockId } })

  return { success: true }
})
