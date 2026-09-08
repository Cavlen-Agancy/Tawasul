import { defineEventHandler, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { formatDateUTC } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['STAFF'])

  const permissions = await prisma.permission.findMany({
    where: { userId: auth.userId },
  })

  const hasStaffPerm = permissions.some((p) => p.resource === 'STAFF')
  const hasSettingsPerm = permissions.some((p) => p.resource === 'SETTINGS')
  const isSuperAdmin = permissions.length >= 6

  if (!hasStaffPerm && !hasSettingsPerm && !isSuperAdmin) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to view the admin overview',
    })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalBookingsThisMonth,
    totalBookingsAllTime,
    revenueMonth,
    revenueAll,
    totalActivePatients,
    totalActiveDoctors,
    recent,
  ] = await Promise.all([
    prisma.booking.count({
      where: { status: 'CONFIRMED', createdAt: { gte: monthStart } },
    }),
    prisma.booking.count({ where: { status: 'CONFIRMED' } }),
    prisma.payment.aggregate({
      where: { status: 'SUCCESS', createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
    }),
    prisma.user.count({
      where: { accountType: 'PATIENT', bookings: { some: { status: 'CONFIRMED' } } },
    }),
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.booking.findMany({
      include: {
        user: { select: { name: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return {
    totalBookingsThisMonth,
    totalBookingsAllTime,
    totalRevenueThisMonth: Number(revenueMonth._sum.amount ?? 0),
    totalRevenueAllTime: Number(revenueAll._sum.amount ?? 0),
    totalActivePatients,
    totalActiveDoctors,
    recentBookings: recent.map((b) => ({
      id: b.id,
      patientName: b.user.name,
      doctorName: b.doctor?.user.name ?? null,
      date: formatDateUTC(b.date),
      service: b.service,
      status: b.status,
    })),
  }
})
