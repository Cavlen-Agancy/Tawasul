import { defineEventHandler, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      photo: true,
      doctor: true,
    },
  })

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  if (!user.doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    photo: user.photo,
    bio: user.doctor.bio,
    slug: user.doctor.slug,
    specializations: user.doctor.specializations,
    isActive: user.doctor.isActive,
  }
})
