import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { formatDateUTC } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'PATIENTS', 'READ')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Patient ID is required' })
  }

  const patient = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      photo: true,
      accountType: true,
      createdAt: true,
        bookings: {
          include: {
            doctor: { include: { user: { select: { name: true } } } },
            doctorNotes: {
              include: {
                doctor: { include: { user: { select: { name: true } } } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { date: 'desc' },
        },
    },
  })

  if (!patient || patient.accountType !== 'PATIENT') {
    throw createError({ statusCode: 404, message: 'Patient not found' })
  }

  const payments = await prisma.payment.findMany({
    where: { booking: { userId: id } },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      gatewayReference: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    id: patient.id,
    name: patient.name,
    email: patient.email,
    phone: patient.phone,
    photo: patient.photo,
    createdAt: patient.createdAt,
    bookings: patient.bookings.map((b) => ({
      id: b.id,
      doctorName: b.doctor?.user.name ?? null,
      date: formatDateUTC(b.date),
      startTime: b.startTime,
      endTime: b.endTime,
      service: b.service,
      status: b.status,
      doctorNotes: b.doctorNotes.map((n) => ({
        id: n.id,
        content: n.content,
        doctorName: n.doctor.user.name,
        createdAt: n.createdAt,
      })),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      gatewayReference: p.gatewayReference,
    })),
  }
})
