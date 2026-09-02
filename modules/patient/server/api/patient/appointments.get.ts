import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { patientAppointmentsQuerySchema } from '~/server/utils/validation'
import { formatDateISO } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const query = getQuery(event)
  const parsed = patientAppointmentsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid tab value' })
  }
  const tab = parsed.data.tab

  const todayISO = formatDateISO(new Date())
  const today = new Date(`${todayISO}T00:00:00`)

  const bookings = await prisma.booking.findMany({
    where: {
      userId: auth.userId,
      ...(tab === 'upcoming'
        ? { status: 'CONFIRMED', date: { gte: today } }
        : {
            OR: [
              { status: 'CANCELLED' },
              { status: 'CONFIRMED', date: { lt: today } },
            ],
          }),
    },
    include: {
      doctor: { include: { user: { select: { name: true, photo: true } } } },
      sessionRoom: { select: { roomName: true } },
    },
    orderBy: { date: tab === 'upcoming' ? 'asc' : 'desc' },
  })

  const appointments = bookings.map((b) => ({
    id: b.id,
    doctorName: b.doctor?.user?.name ?? 'Unknown Doctor',
    doctorPhoto: b.doctor?.user?.photo ?? undefined,
    date: formatDateISO(b.date),
    startTime: b.startTime,
    endTime: b.endTime,
    service: b.service,
    status: b.status,
    sessionRoom: b.sessionRoom ? { roomName: b.sessionRoom.roomName } : undefined,
  }))

  return { appointments }
})
