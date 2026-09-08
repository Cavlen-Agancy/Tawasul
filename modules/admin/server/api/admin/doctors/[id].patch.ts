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

  const userUpdateData: { name?: string; phone?: string | null; isActive?: boolean } = {}
  if (name !== undefined) userUpdateData.name = name
  if (phone !== undefined) userUpdateData.phone = phone ? phone : null
  if (isActive !== undefined) userUpdateData.isActive = isActive

  const doctorUpdateData: { isActive?: boolean; bio?: string | null; specializations?: string[] } = {}
  if (isActive !== undefined) doctorUpdateData.isActive = isActive
  if (bio !== undefined) doctorUpdateData.bio = bio ? bio : null
  if (specializations !== undefined) doctorUpdateData.specializations = specializations

  const ops = []
  if (Object.keys(userUpdateData).length > 0) {
    ops.push(prisma.user.update({ where: { id: doctor.userId }, data: userUpdateData }))
  }
  if (Object.keys(doctorUpdateData).length > 0) {
    ops.push(prisma.doctor.update({ where: { id }, data: doctorUpdateData }))
  }

  if (ops.length > 0) {
    await prisma.$transaction(ops)
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
