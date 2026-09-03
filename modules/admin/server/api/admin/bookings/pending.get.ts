import { defineEventHandler } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { formatDateISO } from '~/server/utils/admin-availability'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'APPOINTMENTS', 'READ')

  const bookings = await prisma.booking.findMany({
    where: { status: 'PENDING' },
    orderBy: { date: 'asc' },
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
  })

  return {
    bookings: bookings.map((b) => ({
      id: b.id,
      patientName: b.user.name,
      patientEmail: b.user.email,
      patientPhone: b.user.phone ?? '',
      date: formatDateISO(b.date),
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      createdAt: b.createdAt,
    })),
  }
})