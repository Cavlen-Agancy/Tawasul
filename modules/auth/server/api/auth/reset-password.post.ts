import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { hashPassword } from '~/server/utils/auth'
import { resetPasswordSchema, validationMessage } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }
  const { token, newPassword } = parsed.data

  const user = await prisma.user.findFirst({ where: { passwordResetToken: token } })
  if (!user) {
    throw createError({ statusCode: 400, message: 'Invalid or expired link' })
  }

  if (user.passwordResetExpiry && user.passwordResetExpiry.getTime() < Date.now()) {
    throw createError({ statusCode: 400, message: 'Link has expired' })
  }

  const hashedPassword = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  })

  return { message: 'Password updated successfully.' }
})