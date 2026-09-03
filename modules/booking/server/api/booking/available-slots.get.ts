import { defineEventHandler, getQuery, createError } from 'h3'
import { getAdminAvailableSlots } from '~/server/utils/admin-availability'
import { availableSlotsQuerySchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = availableSlotsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid date format' })
  }

  const slots = await getAdminAvailableSlots(parsed.data.date)
  return { slots }
})
