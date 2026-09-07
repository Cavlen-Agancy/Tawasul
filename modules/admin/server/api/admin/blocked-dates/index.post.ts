import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { blockedDateSchema } from '~/server/utils/validation'
import { formatDateISO } from '~/server/utils/admin-availability'
import { parseDateUTC } from '~/server/utils/availability'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'SETTINGS', 'UPDATE')

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = blockedDateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const { date, reason } = parsed.data

  if (date < formatDateISO(new Date())) {
    throw createError({ statusCode: 400, message: 'Date must be in the future' })
  }

  const existing = await prisma.globalBlockedDate.findUnique({ where: { date: parseDateUTC(date) } })
  if (existing) {
    throw createError({ statusCode: 409, message: 'This date is already blocked' })
  }

  const blockedDate = await prisma.globalBlockedDate.create({
    data: {
      date: parseDateUTC(date),
      reason: reason || null,
    },
  })

  setResponseStatus(event, 201)
  return { blockedDate }
})