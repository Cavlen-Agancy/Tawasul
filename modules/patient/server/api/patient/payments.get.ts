import { defineEventHandler, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { formatDateUTC } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const payments = await prisma.payment.findMany({
    where: {
      booking: {
        userId: auth.userId,
      },
    },
    include: {
      booking: {
        include: {
          doctor: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      booking: {
        doctorName: p.booking?.doctor?.user?.name ?? 'Unknown Doctor',
        date: p.booking ? formatDateUTC(p.booking.date) : '',
        service: p.booking?.service ?? '',
      },
    })),
  }
})
