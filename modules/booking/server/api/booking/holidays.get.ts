import { defineEventHandler, getQuery, createError } from 'h3'
import { getEgyptianHolidays } from '~/server/utils/holidays'
import { monthYearQuerySchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = monthYearQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid month or year' })
  }

  return { holidays: getEgyptianHolidays(parsed.data.month, parsed.data.year) }
})