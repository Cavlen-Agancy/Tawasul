import { defineEventHandler, getQuery, createError } from 'h3'
import { getAvailableSlots } from '~/server/utils/availability'
import { availableSlotsQuerySchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = availableSlotsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid date format' })
  }

  const slots = await getAvailableSlots(parsed.data.date)
  return { slots }
})
