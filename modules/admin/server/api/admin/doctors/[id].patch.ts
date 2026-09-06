import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { adminDoctorPatchSchema, validationMessage } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'DOCTORS', 'UPDATE')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Doctor ID is required' })
  }

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = adminDoctorPatchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }

  const doctor = await prisma.doctor.findUnique({ where: { id } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor not found' })
  }

  const { name, phone, bio, specializations, isActive } = parsed.data

  if (name !== undefined || phone !== undefined || isActive !== undefined) {
    await prisma.user.update({
      where: { id: doctor.userId },
      data: {
        name: name ?? undefined,
        phone: phone !== undefined ? (phone ? phone : null) : undefined,
      },
    })
  }

  if (isActive !== undefined) {
    await prisma.doctor.update({ where: { id }, data: { isActive } })
  }

  if (bio !== undefined || specializations !== undefined) {
    await prisma.doctor.update({
      where: { id },
      data: {
        bio: bio !== undefined ? (bio ? bio : null) : undefined,
        specializations: specializations ?? undefined,
      },
    })
  }

  const updated = await prisma.doctor.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, photo: true } },
    },
  })

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Doctor not found' })
  }

  return {
    id: updated.id,
    userId: updated.userId,
    name: updated.user.name,
    email: updated.user.email,
    phone: updated.user.phone,
    photo: updated.user.photo,
    bio: updated.bio,
    slug: updated.slug,
    specializations: updated.specializations,
    isActive: updated.isActive,
  }
})
