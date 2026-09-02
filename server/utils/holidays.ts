function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Official Egyptian public holidays.
 *
 * This module is the single, maintainable source of truth for which days the
 * application treats as public holidays. Doctor availability (see
 * availability.ts) is kept SEPARATE from holidays so the system can decide:
 *
 *   holiday + no availability  -> unavailable
 *   holiday + explicit booking -> the configured business rule below
 *
 * CONFIGURED BUSINESS RULE
 * ------------------------
 * Holidays are NON-WORKING days for the clinic. A public holiday therefore
 * blocks booking REGARDLESS of standing per-doctor availability:
 *
 *   - No time slots are generated for a holiday date.
 *   - A holiday date is excluded from the available-dates list.
 *   - Server-side booking creation (`POST /api/booking/create`) rejects a
 *     holiday by never seeing the slot as available (getAvailableSlots is the
 *     single authority), so a holiday can never be booked.
 *
 * To temporarily open a holiday for bookings, add its `YYYY-MM-DD` to
 * `OPENED_HOLIDAYS` below; those dates are then treated purely by doctor
 * availability (the holiday is still surfaced on the calendar, but booking is
 * allowed where availability exists).
 *
 * To keep this maintainable, fixed Gregorian holidays are listed explicitly
 * and the (shifting) religious holidays are generated for the requested year.
 */

// Fixed-date Gregorian Egyptian public holidays (month, day) => name.
const FIXED_HOLIDAYS: ReadonlyArray<readonly [number, number, string]> = [
  [1, 7, 'Coptic Christmas'],
  [1, 25, 'Revolution Day (Jan 25)'],
  [4, 25, 'Sinai Liberation Day'],
  [5, 1, 'Labour Day'],
  [6, 30, 'June 30 Revolution'],
  [7, 23, 'Revolution Day (Jul 23)'],
  [10, 6, 'Armed Forces Day'],
]

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Computes Easter (Gregorian) for a given year using the Anonymous Gregorian
 * algorithm. Used to derive Coptic Easter Monday (a public holiday).
 */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/**
 * Approximates the Hijri/Islamic lunar holidays (Eid al-Fitr, Eid al-Adha,
 * Islamic New Year, Prophet's Birthday) for a given Gregorian year. These dates
 * shift year to year (each ~11 days earlier in the Gregorian calendar). The
 * table below holds known/astronomical Gregorian dates for the supported
 * window (2024-2027). Extend the table as new years come into scope.
 */
function islamicHolidays(year: number): Array<[string, string]> {
  const table: Record<number, Record<string, string>> = {
    2024: {
      '2024-04-10': 'Eid al-Fitr holiday',
      '2024-06-16': 'Eid al-Adha holiday',
      '2024-07-07': 'Islamic New Year',
      '2024-09-15': 'Prophet’s Birthday',
    },
    2025: {
      '2025-03-30': 'Eid al-Fitr holiday',
      '2025-06-06': 'Eid al-Adha holiday',
      '2025-06-26': 'Islamic New Year',
      '2025-09-04': 'Prophet’s Birthday',
    },
    2026: {
      '2026-03-20': 'Eid al-Fitr holiday',
      '2026-05-27': 'Eid al-Adha holiday',
      '2026-06-16': 'Islamic New Year',
      '2026-08-24': 'Prophet’s Birthday',
    },
    2027: {
      '2027-03-09': 'Eid al-Fitr holiday',
      '2027-05-16': 'Eid al-Adha holiday',
      '2027-06-05': 'Islamic New Year',
      '2027-08-13': 'Prophet’s Birthday',
    },
  }
  const yearTable = table[year] ?? {}
  return Object.entries(yearTable)
}

/** Returns every holiday in a given month (1-12) of a year as { date, name }. */
export function getEgyptianHolidays(month: number, year: number): Array<{ date: string; name: string }> {
  const out = new Map<string, string>()

  for (const [m, d, name] of FIXED_HOLIDAYS) {
    if (m === month) out.set(dateKey(year, m, d), name)
  }

  // Coptic Easter Monday = day after Easter.
  if (month === 1 || month === 2 || month === 3 || month === 4) {
    const easter = easterSunday(year)
    const easterMonday = addDays(easter, 1)
    if (easterMonday.getMonth() + 1 === month) {
      out.set(dateKey(year, easterMonday.getMonth() + 1, easterMonday.getDate()), 'Coptic Easter Monday')
    }
  }

  // Coptic Christmas (Jan 7) is in FIXED_HOLIDAYS.

  // Shifting lunar/religious holidays.
  for (const [date, name] of islamicHolidays(year)) {
    const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
    if (y === year && m === month) out.set(date, name)
  }

  return Array.from(out.entries())
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Returns the holiday (if any) for a specific 'YYYY-MM-DD' date, else null. */
export function isHoliday(date: string): { date: string; name: string } | null {
  const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
  if (!y || !m || !d) return null
  const holiday = getEgyptianHolidays(m, y).find((h) => h.date === date)
  return holiday ?? null
}