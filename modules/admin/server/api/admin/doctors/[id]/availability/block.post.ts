import { defineEventHandler, readBody, getRouterParam, createError, setResponseStatus } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { blockSlotSchema, validationMessage } from '~/server/utils/validation'
import { formatDateISO } from '~/server/utils/admin-availability'
import { parseDateUTC } from '~/server/utils/availability'
import { timeToMinutes } from '~/server/utils/availability'

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'DOCTORS', 'UPDATE')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Doctor ID is required' })
  }

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = blockSlotSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }
  const { date, startTime, endTime } = parsed.data

  const doctor = await prisma.doctor.findUnique({ where: { id } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor not found' })
  }

  if (date < formatDateISO(new Date())) {
    throw createError({ statusCode: 400, message: 'Date must be in the future' })
  }

  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    throw createError({ statusCode: 400, message: 'startTime must be before endTime' })
  }

  const dayStart = timeToMinutes(startTime)
  const dayEnd = timeToMinutes(endTime)
  const target = parseDateUTC(date)

  const existingBlocks = await prisma.blockedSlot.findMany({
    where: { doctorId: id, date: target },
    select: { startTime: true, endTime: true },
  })
  if (existingBlocks.some((b) => overlaps(dayStart, dayEnd, timeToMinutes(b.startTime), timeToMinutes(b.endTime)))) {
    throw createError({ statusCode: 400, message: 'This time is already blocked' })
  }

  const confirmed = await prisma.booking.findMany({
    where: { doctorId: id, date: target, status: 'CONFIRMED' },
    select: { startTime: true, endTime: true },
  })
  if (confirmed.some((b) => overlaps(dayStart, dayEnd, timeToMinutes(b.startTime), timeToMinutes(b.endTime)))) {
    throw createError({ statusCode: 400, message: 'Doctor already has a booking at this time' })
  }

  const blockedSlot = await prisma.blockedSlot.create({
    data: { doctorId: id, date: target, startTime, endTime },
  })

  setResponseStatus(event, 201)
  return { blockedSlot }
})
