import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'DOCTORS', 'READ')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Doctor ID is required' })
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, photo: true } },
      availability: true,
      blockedSlots: true,
    },
  })

  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor not found' })
  }

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999))

  const [sessionCountThisMonth, sessionCountAllTime] = await Promise.all([
    prisma.booking.count({
      where: { doctorId: doctor.id, status: 'CONFIRMED', date: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.booking.count({
      where: { doctorId: doctor.id, status: 'CONFIRMED' },
    }),
  ])

  return {
    id: doctor.id,
    userId: doctor.userId,
    name: doctor.user.name,
    email: doctor.user.email,
    phone: doctor.user.phone,
    photo: doctor.user.photo,
    bio: doctor.bio,
    slug: doctor.slug,
    specializations: doctor.specializations,
    isActive: doctor.isActive,
    availability: doctor.availability,
    blockedSlots: doctor.blockedSlots,
    sessionCountThisMonth,
    sessionCountAllTime,
  }
})
