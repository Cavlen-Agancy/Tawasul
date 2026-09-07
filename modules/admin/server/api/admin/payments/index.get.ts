import { defineEventHandler, getQuery } from 'h3'
import type { PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { formatDateUTC } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'PAYMENTS', 'READ')

  const query = getQuery(event)
  const where: Prisma.PaymentWhereInput = {}

  if (query.start || query.end) {
    where.createdAt = {}
    if (query.start) where.createdAt.gte = new Date(`${String(query.start)}T00:00:00`)
    if (query.end) where.createdAt.lte = new Date(`${String(query.end)}T23:59:59`)
  }
  if (query.status) where.status = String(query.status) as PaymentStatus
  if (query.doctorId) where.booking = { doctorId: String(query.doctorId) }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      booking: {
        include: {
          user: { select: { name: true } },
          doctor: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const baseWhere = { ...where } as typeof where
  delete baseWhere.status

  const [successSum, monthSum, refundedSum] = await Promise.all([
    prisma.payment.aggregate({
      where: { ...baseWhere, status: 'SUCCESS' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { ...baseWhere, status: 'SUCCESS', createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { ...baseWhere, status: 'REFUNDED' },
      _sum: { amount: true },
    }),
  ])

  return {
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      gatewayReference: p.gatewayReference,
      patientName: p.booking.user.name,
      doctorName: p.booking.doctor?.user.name ?? null,
      service: p.booking.service,
      bookingDate: formatDateUTC(p.booking.date),
    })),
    summary: {
      totalRevenue: Number(successSum._sum.amount ?? 0),
      totalRevenueThisMonth: Number(monthSum._sum.amount ?? 0),
      totalRefunded: Number(refundedSum._sum.amount ?? 0),
    },
  }
})
