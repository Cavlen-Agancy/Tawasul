import { defineEventHandler, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

interface SafeUser {
  id: string
  name: string
  email: string
  phone?: string
  photo?: string
  accountType: string
  permissions?: { resource: string; action: string }[]
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      photo: true,
      accountType: true,
      permissions: true,
      password: false,
    },
  })

  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const payload: SafeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? undefined,
    photo: user.photo ?? undefined,
    accountType: user.accountType,
  }

  if (user.accountType === 'STAFF') {
    payload.permissions = user.permissions.map((p) => ({ resource: p.resource, action: p.action }))
  }

  return payload
})