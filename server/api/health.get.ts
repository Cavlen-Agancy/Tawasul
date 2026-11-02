import { defineEventHandler, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok' }
  } catch {
    throw createError({ statusCode: 503, message: 'Database unavailable' })
  }
})
