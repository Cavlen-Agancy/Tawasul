import { defineEventHandler, getQuery, createError } from 'h3'
import { getAvailableDates } from '~/server/utils/availability'
import { availableDatesQuerySchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = availableDatesQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid month or year' })
  }

  const dates = await getAvailableDates(parsed.data.month, parsed.data.year)
  return { dates }
})
