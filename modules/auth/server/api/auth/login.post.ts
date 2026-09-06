import { defineEventHandler, readBody, createError, setCookie } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { comparePassword, generateJWT } from '~/server/utils/auth'
import { loginSchema, validationMessage } from '~/server/utils/validation'

function safeUser(user: {
  id: string
  name: string
  email: string
  photo: string | null
  accountType: string
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    photo: user.photo ?? undefined,
    accountType: user.accountType,
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const valid = await comparePassword(password, user.password)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  if (!user.emailVerified) {
    throw createError({ statusCode: 403, message: 'Please verify your email before logging in' })
  }

  if (!user.isActive) {
    throw createError({ statusCode: 403, message: 'Your account has been deactivated' })
  }

  const token = generateJWT({
    userId: user.id,
    email: user.email,
    accountType: user.accountType,
  })

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return safeUser(user)
})
