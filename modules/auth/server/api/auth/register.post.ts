import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { hashPassword, setAuthSessionCookie } from '~/server/utils/auth'
import { authRegisterSchema, validationMessage } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = authRegisterSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }
  const data = parsed.data

  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } })
  if (existing) {
    throw createError({ statusCode: 400, message: 'Email already in use' })
  }

  const hashedPassword = await hashPassword(data.password)

  const user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      password: hashedPassword,
      accountType: 'PATIENT',
      emailVerified: true,
      isActive: true,
    },
  })

  setAuthSessionCookie(event, {
    userId: user.id,
    email: user.email,
    accountType: user.accountType,
  })

  setResponseStatus(event, 201)
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    accountType: user.accountType,
  }
})