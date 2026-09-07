import { defineEventHandler } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'SETTINGS', 'UPDATE')

  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const blockedDates = await prisma.globalBlockedDate.findMany({
    where: { date: { gte: todayStart } },
    orderBy: { date: 'asc' },
  })

  return { blockedDates }
})