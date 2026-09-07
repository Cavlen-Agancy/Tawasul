import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'DOCTORS', 'READ')

  const query = getQuery(event)
  const activeOnly = query.active === 'true'

  const doctors = await prisma.doctor.findMany({
    where: activeOnly ? { isActive: true } : {},
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          photo: true,
        },
      },
    },
    orderBy: { isActive: 'desc' },
  })

  const doctorIds = doctors.map((d) => d.id)
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999))

  const [monthCounts, allCounts] = await Promise.all([
    prisma.booking.groupBy({
      by: ['doctorId'],
      where: { status: 'CONFIRMED', doctorId: { in: doctorIds }, date: { gte: monthStart, lte: monthEnd } },
      _count: { _all: true },
    }),
    prisma.booking.groupBy({
      by: ['doctorId'],
      where: { status: 'CONFIRMED', doctorId: { in: doctorIds } },
      _count: { _all: true },
    }),
  ])

  const monthMap = new Map(monthCounts.map((c) => [c.doctorId, c._count._all]))
  const allMap = new Map(allCounts.map((c) => [c.doctorId, c._count._all]))

  return {
    doctors: doctors.map((d) => ({
      id: d.id,
      name: d.user.name,
      email: d.user.email,
      phone: d.user.phone,
      photo: d.user.photo,
      specializations: d.specializations,
      isActive: d.isActive,
      slug: d.slug,
      sessionCountThisMonth: monthMap.get(d.id) ?? 0,
      sessionCountAllTime: allMap.get(d.id) ?? 0,
    })),
  }
})
