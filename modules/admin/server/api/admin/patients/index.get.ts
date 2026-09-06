import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { formatDateISO } from '~/server/utils/admin-availability'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'PATIENTS', 'READ')

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const patients = await prisma.user.findMany({
    where: {
      accountType: 'PATIENT',
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      photo: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const patientIds = patients.map((p) => p.id)

  const [counts, lastDates] = await Promise.all([
    prisma.booking.groupBy({
      by: ['userId'],
      where: { status: 'CONFIRMED', userId: { in: patientIds } },
      _count: { _all: true },
    }),
    prisma.booking.groupBy({
      by: ['userId'],
      where: { status: 'CONFIRMED', userId: { in: patientIds } },
      _max: { date: true },
    }),
  ])

  const countMap = new Map(counts.map((c) => [c.userId, c._count._all]))
  const lastMap = new Map(lastDates.map((c) => [c.userId, c._max.date]))

  return {
    patients: patients.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      photo: p.photo,
      totalSessions: countMap.get(p.id) ?? 0,
      lastSessionDate: lastMap.get(p.id) ? formatDateISO(lastMap.get(p.id) as Date) : null,
      createdAt: p.createdAt,
    })),
  }
})
