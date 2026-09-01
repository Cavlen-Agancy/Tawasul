import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { generateToken } from '~/server/utils/auth'
import { sendEmail, passwordResetTemplate } from '~/server/utils/email'
import { forgotPasswordSchema } from '~/server/utils/validation'

const SUCCESS_MESSAGE = 'If this email exists, a reset link has been sent.'

export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return { message: SUCCESS_MESSAGE }
  }
  const { email } = parsed.data

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) {
    return { message: SUCCESS_MESSAGE }
  }

  const resetToken = generateToken()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetToken,
      passwordResetExpiry: expiresAt,
    },
  })

  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
  try {
    await sendEmail({
      to: user.email,
      subject: 'Reset your Tawasul Academy password',
      html: passwordResetTemplate(user.name, resetUrl),
    })
  } catch (error) {
    console.error('[auth/forgot-password] Reset email could not be sent:', error)
  }

  return { message: SUCCESS_MESSAGE }
})