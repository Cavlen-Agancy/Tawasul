import { defineEventHandler } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'SETTINGS', 'UPDATE')

  const blockedDates = await prisma.globalBlockedDate.findMany({
    where: { date: { gte: new Date() } },
    orderBy: { date: 'asc' },
  })

  return { blockedDates }
})