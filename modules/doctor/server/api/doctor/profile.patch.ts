import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { doctorProfilePatchSchema, validationMessage } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])
  const body = await readBody<unknown>(event).catch(() => undefined)

  const parsed = doctorProfilePatchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: auth.userId } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  const { name, phone, bio, specializations } = parsed.data

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      name,
      phone: phone ? phone : null,
    },
  })

  await prisma.doctor.update({
    where: { id: doctor.id },
    data: {
      bio: bio !== undefined ? (bio ? bio : null) : undefined,
      specializations: specializations ?? undefined,
    },
  })

  const updated = await prisma.user.findUnique({
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

  if (!updated?.doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    photo: updated.photo,
    bio: updated.doctor.bio,
    slug: updated.doctor.slug,
    specializations: updated.doctor.specializations,
    isActive: updated.doctor.isActive,
  }
})
