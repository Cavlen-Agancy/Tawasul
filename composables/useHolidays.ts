import { getEgyptianHolidays, isHoliday } from '~/server/utils/holidays'

/**
 * Client-safe accessor for Egyptian public-holiday data.
 * `server/utils/holidays.ts` is pure static data (no Node APIs),
 * so it can be imported directly in the client bundle.
 */
export function useHolidays() {
  return {
    getEgyptianHolidays,
    isHoliday,
  }
}
