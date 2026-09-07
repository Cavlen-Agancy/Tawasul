# PATIENT-CALENDAR-REPORT.md — Patient dashboard calendar (`/dashboard/appointments`)

## Summary

The dashboard calendar is a **read-only overview + handoff**, not a booking
widget. The backend is healthy: on the live server right now,
`GET /api/booking/available-dates?month=9&year=2026` returns **22 dates** (every
September weekday) and `GET /api/booking/available-slots?date=2026-09-09`
returns a full slot list. So "no availability anywhere" is **not** a data or
API problem — it is a rendering/expectation problem, or the clicks landed on
days that legitimately have nothing (weekends, past days, holidays), or a
client-side fetch failed silently (see Findings).

Two expectation mismatches explain most of the report:
1. **There are no magenta "dots" by design.** Availability is rendered as a
   **magenta date number** (`#e91e8c`, bold), not a dot. Only bookings get dots
   (green = confirmed, yellow = pending). Someone scanning for dots concludes
   "no availability indication" even on a working calendar.
2. **The panel never books inline.** Its slot buttons deep-link to
   `/book?date=…&time=…`, and its empty state is a "Book Now" button to `/book`.
   Seeing "Book Now" instead of slots means the clicked day had no bookings
   **and** no slots — which is the correct output for weekends.

## Code flow (what should happen)

1. Mount (`appointments.vue:319-328`): `fetchAllBookings()` loads
   `GET /api/patient/appointments?tab=all` into `allBookings`; `loadMonth()`
   loads `GET /api/booking/available-dates?month&year` into `availableDates`
   (`usePatientDashboard.ts:162-173`, `192-200`).
2. `datesSet` (`appointments.vue:122-139`): on every view change, fetches that
   month's dates, then bumps `calendarKey` to remount FullCalendar because
   FullCalendar does not re-evaluate `dayCellClassNames` when async data lands.
3. Cell styling (`appointments.vue:102-112` + CSS `:596-617`):
   past → `fc-past` (dimmed, `pointer-events: none`); holiday → `fc-holiday`
   (grey, struck-through); else confirmed → green dot, pending → yellow dot,
   else in-`availableDates` → `fc-available` (**magenta bold number**, pointer
   cursor); otherwise plain.
4. Click (`onDateClick`, `:141-156`): ignore other-month cells, past days, and
   holidays (toast). Otherwise `selectDate(dateStr)` (`usePatientDashboard.ts:
   192-200`): set `selectedDate`, clear slots, filter `allBookings` by string
   equality; **only if zero bookings**, fetch
   `GET /api/booking/available-slots?date=…`.
5. Panel (`:392-499`): bookings list → else slot buttons (each
   `bookSlot()` → `navigateTo('/book?date&time')`, `:201-204`) → else
   `day-empty` block (`:493-497`): *"No appointments or available slots on this
   day…"* + **Book Now → `/book` (no prefill)**.
6. `/book` (`modules/booking/pages/book.vue:33-43`): reads `?date=&time=`,
   re-validates the slot via `fetchAvailableSlots(date)`, and runs the real
   booking flow (calendar + times + review + payment). Without params it starts
   blank. It never reads dashboard state — the query string is the whole
   contract.

## Findings

- **F1 — No magenta dots exist (design, not bug).** `fc-available` styles the
  number, not a dot (`:599-602`); dots are booking-only (`:603-617`). The
  legend's "Available day" swatch is a bordered square, matching the number
  treatment. Anyone told to look for "magenta dots" will report them missing
  on a healthy calendar.
- **F2 — Seed schedule is Mon–Fri only** (`admin_schedules`: days 1–5,
  09:00–17:00, verified live in DB). Saturdays/Sundays can never be magenta
  and always render the "Book Now" empty state. Clicking a weekend is the most
  likely source of screenshot "Book Now instead of slots".
- **F3 — Silent failure mode.** `fetchAvailableDates`/`fetchAvailableSlots`
  (`usePatientDashboard.ts:162-186`) catch errors, return `[]`, and only set a
  small `error` line at the page top (`appointments.vue` error banner). A
  failed fetch produces exactly the reported symptoms — no magenta anywhere,
  every click ends at "Book Now" — with almost no visible signal.
- **F4 — Bookings hide slots.** `selectDate` fetches slots only when the day
  has zero bookings (`usePatientDashboard.ts:196-198`). Clicking a booked day
  can never reveal that day's remaining free times; the only path to them is
  `/book`.
- **F5 — Past/holiday/other-month clicks are inert by design** (`:142-148`,
  plus `.fc-past { pointer-events: none }` at `:593-595`). A calendar viewed
  mostly in the past (e.g. wrong month) looks "locked".
- **F6 — No `dayCellDidMount`/event rendering is used** — only
  `dayCellClassNames` (`:314`) + `dateClick` (`:315`) + `datesSet` (`:316`).
  There is no FullCalendar `events` source; dots come purely from the class
  function, so anything that prevents the post-fetch remount (`calendarKey`)
  freezes the month unstyled.
- **F7 — Data prerequisites are currently satisfied** (live DB):
  5 active `AdminSchedule` rows, 0 `GlobalBlockedDate` rows. The 14 existing
  `Booking` rows only consume single hours (CONFIRMED-only filtering in
  `getAdminAvailableSlots`, `server/utils/admin-availability.ts:80-84`), so
  they cannot empty a day.

## Root cause (ranked)

1. **Weekend clicks + dot-vs-number expectation mismatch (F1 + F2).** Most
   probable: the observed days had no schedule by design, and availability —
   where present — is a magenta number, not a dot.
2. **A failed client-side fetch rendering as "locked" (F3).** Second most
   probable if weekdays were also bare: one failed `available-dates` call
   empties the whole month's styling, and each click's failed slots call lands
   on "Book Now". Check browser network tab + the page-top error line.
3. **Stale server / wrong environment / logged-out session.** The APIs above
   respond correctly on `:3000` now; anything else (stale build, auth
   redirect) mimics the same screenshots.
4. Backend availability logic is **exonerated**: endpoint output verified live.

## Recommendations

- **R1 (expectation):** decide whether availability should be a real dot to
  match user language; if so, add an `::before`/`::after` marker for
  `fc-available` mirroring the booking dots, and update the legend swatch.
- **R2 (weekends):** distinguish "no clinic on weekends" from "no slots":
  e.g. dim weekend cells and change the empty message per reason, instead of
  the generic "Book Now".
- **R3 (silent failure):** surface fetch failures in the panel/calendar area
  (retry button), not just the top error line; consider skeleton persistence
  while `availableDates` is empty on first load.
- **R4 (bookings hide slots):** optionally fetch slots alongside bookings so a
  booked day can still offer remaining free times.
- **R5 (diagnostics):** add a `data-testid` exposing the loaded dates count
  (or console debug) so "empty because no data" vs "empty because fetch
  failed" is distinguishable in screenshots/tests.

## Data actually fetched and displayed

- `GET /api/patient/appointments?tab=all` → booking cards + green/yellow dots
  (string-compared per day).
- `GET /api/booking/available-dates?month&year` → `{ dates: string[] }` →
  magenta numbers.
- `GET /api/booking/available-slots?date=` (only for booking-free clicked
  days) → slot buttons that hand off to `/book?date=&time=`.
- Dashboard writes nothing; all booking writes happen on `/book` (create +
  payment), admin assignment later flips PENDING → CONFIRMED.
