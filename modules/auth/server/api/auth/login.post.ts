import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { comparePassword, setAuthSessionCookie } from '~/server/utils/auth'
import { loginSchema, validationMessage } from '~/server/utils/validation'

function safeUser(user: {
  id: string
  name: string
  email: string
  photo: string | null
  accountType: string
  permissions?: { resource: string; action: string }[]
}) {
  const res: {
    id: string
    name: string
    email: string
    photo?: string
    accountType: string
    permissions?: { resource: string; action: string }[]
  } = {
    id: user.id,
    name: user.name,
    email: user.email,
    photo: user.photo ?? undefined,
    accountType: user.accountType,
  }

  if (user.accountType === 'STAFF' && user.permissions) {
    res.permissions = user.permissions.map((p) => ({ resource: p.resource, action: p.action }))
  }

  return res
}

export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      permissions: {
        select: { resource: true, action: true },
      },
    },
  })

  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const valid = await comparePassword(password, user.password)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  if (!user.isActive) {
    throw createError({ statusCode: 403, message: 'Your account has been deactivated' })
  }

  setAuthSessionCookie(event, {
    userId: user.id,
    email: user.email,
    accountType: user.accountType,
  })

  return safeUser(user)
})
