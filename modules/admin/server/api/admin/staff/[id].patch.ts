import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { staffPatchSchema, validationMessage } from '~/server/utils/validation'

const VALID_RESOURCES = new Set(['APPOINTMENTS', 'PATIENTS', 'DOCTORS', 'PAYMENTS', 'SETTINGS', 'STAFF'])
const VALID_ACTIONS = new Set(['CREATE', 'READ', 'UPDATE', 'DELETE'])

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'STAFF', 'UPDATE')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Staff ID is required' })
  }

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = staffPatchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.accountType !== 'STAFF') {
    throw createError({ statusCode: 404, message: 'Staff member not found' })
  }

  const { name, phone, permissions, isActive } = parsed.data

  const seedEmail = process.env.SEED_ADMIN_EMAIL
  if (seedEmail && target.email.toLowerCase() === seedEmail.toLowerCase()) {
    if (isActive === false) {
      throw createError({ statusCode: 403, message: 'Cannot deactivate seed admin' })
    }
    if (permissions !== undefined && permissions.length === 0) {
      throw createError({ statusCode: 403, message: 'Cannot remove permissions from seed admin' })
    }
  }

  if (permissions) {
    for (const p of permissions) {
      if (!VALID_RESOURCES.has(p.resource) || !VALID_ACTIONS.has(p.action)) {
        throw createError({ statusCode: 400, message: 'Invalid permission' })
      }
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: name ?? undefined,
      phone: phone !== undefined ? (phone ? phone : null) : undefined,
      isActive: isActive ?? undefined,
    },
  })

  if (permissions) {
    await prisma.$transaction([
      prisma.permission.deleteMany({ where: { userId: id } }),
      prisma.permission.createMany({
        data: permissions.map((p) => ({
          userId: id,
          resource: p.resource as never,
          action: p.action as never,
        })),
      }),
    ])
  }

  const updated = await prisma.user.findUnique({
    where: { id },
    include: { permissions: { select: { resource: true, action: true } } },
  })

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Staff member not found' })
  }

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    photo: updated.photo,
    isActive: updated.isActive,
    permissions: updated.permissions,
  }
})
