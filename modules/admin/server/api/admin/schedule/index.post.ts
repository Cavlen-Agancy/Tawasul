import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { scheduleSchema } from '~/server/utils/validation'

const VALID_SESSION_DURATIONS = [30, 45, 60]

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'SETTINGS', 'UPDATE')

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = scheduleSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const { dayOfWeek, startTime, endTime, sessionDuration } = parsed.data

  if (dayOfWeek < 0 || dayOfWeek > 6) {
    throw createError({ statusCode: 400, message: 'dayOfWeek must be between 0 and 6' })
  }
  if (startTime >= endTime) {
    throw createError({ statusCode: 400, message: 'startTime must be before endTime' })
  }
  if (!VALID_SESSION_DURATIONS.includes(sessionDuration)) {
    throw createError({ statusCode: 400, message: 'sessionDuration must be 30, 45, or 60' })
  }

  const schedule = await prisma.adminSchedule.create({
    data: {
      dayOfWeek,
      startTime,
      endTime,
      sessionDuration,
    },
  })

  setResponseStatus(event, 201)
  return { schedule }
})