import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : ''

  if (!token) {
    throw createError({ statusCode: 400, message: 'Invalid or expired link' })
  }

  const user = await prisma.user.findFirst({ where: { emailVerificationToken: token } })
  if (!user) {
    throw createError({ statusCode: 400, message: 'Invalid or expired link' })
  }

  if (user.emailVerificationExpiry && user.emailVerificationExpiry.getTime() < Date.now()) {
    throw createError({ statusCode: 400, message: 'Link has expired' })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    },
  })

  return { message: 'Email verified. You can now log in.' }
})