import { defineEventHandler } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'SETTINGS', 'UPDATE')

  const schedules = await prisma.adminSchedule.findMany({
    orderBy: { dayOfWeek: 'asc' },
  })

  return { schedules }
})