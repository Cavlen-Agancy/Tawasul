import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { formatDateUTC, parseDateUTC } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'APPOINTMENTS', 'READ')

  const query = getQuery(event)
  const where: {
    date?: { gte?: Date; lte?: Date }
    doctorId?: string
    status?: string
  } = {}

  if (query.start && query.end) {
    where.date = {
      gte: parseDateUTC(String(query.start)),
      lte: parseDateUTC(String(query.end)),
    }
  }
  if (query.doctorId) where.doctorId = String(query.doctorId)
  if (query.status) where.status = String(query.status)

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      user: { select: { name: true, email: true, phone: true } },
      doctor: { include: { user: { select: { name: true } } } },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })

  return {
    bookings: bookings.map((b) => ({
      id: b.id,
      patientName: b.user.name,
      patientEmail: b.user.email,
      patientPhone: b.user.phone ?? '',
      doctorId: b.doctorId,
      doctorName: b.doctor?.user.name ?? null,
      date: formatDateUTC(b.date),
      startTime: b.startTime,
      endTime: b.endTime,
      service: b.service,
      status: b.status,
      createdAt: b.createdAt,
    })),
  }
})