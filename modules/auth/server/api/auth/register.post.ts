import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { hashPassword, generateToken } from '~/server/utils/auth'
import { sendEmail, emailVerificationTemplate } from '~/server/utils/email'
import { authRegisterSchema, validationMessage } from '~/server/utils/validation'
import { getServerRuntimeConfig } from '~/server/utils/runtime'

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
  const verificationToken = generateToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      password: hashedPassword,
      accountType: 'PATIENT',
      emailVerified: false,
      isActive: true,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: expiresAt,
    },
  })

  const appUrl = getServerRuntimeConfig()?.public?.appUrl ?? process.env.APP_URL ?? 'http://localhost:3000'
  const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify your Tawasul Academy account',
      html: emailVerificationTemplate(user.name, verificationUrl),
    })
  } catch (error) {
    console.error('[auth/register] Verification email could not be sent:', error)
  }

  setResponseStatus(event, 201)
  return { message: 'Registration successful. Please check your email.' }
})