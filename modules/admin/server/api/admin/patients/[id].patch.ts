import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { validationMessage } from '~/server/utils/validation'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  try {
    await requirePermission(event, 'PATIENTS', 'UPDATE')
  } catch {
    await requirePermission(event, 'PATIENTS', 'READ')
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Patient ID is required' })
  }

  const patient = await prisma.user.findUnique({ where: { id } })
  if (!patient || patient.accountType !== 'PATIENT') {
    throw createError({ statusCode: 404, message: 'Patient not found' })
  }

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }

  const { name, phone } = parsed.data
  const updateData: { name?: string; phone?: string | null } = {}
  if (name !== undefined) updateData.name = name.trim()
  if (phone !== undefined) updateData.phone = phone ? phone.trim() : null

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      photo: true,
      createdAt: true,
    },
  })

  return { patient: updated }
})
