import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  try {
    await requirePermission(event, 'DOCTORS', 'DELETE')
  } catch {
    await requirePermission(event, 'DOCTORS', 'UPDATE')
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Doctor ID is required' })
  }

  const doctor = await prisma.doctor.findUnique({ where: { id } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor not found' })
  }

  const userId = doctor.userId

  // Delete the doctor record
  await prisma.doctor.delete({ where: { id } })

  // Delete the corresponding user login account
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)

  return { success: true }
})
